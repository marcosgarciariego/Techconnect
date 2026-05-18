import { Server, Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { verifyToken } from '../middleware/auth';
import prisma from '../config/database';
import { createNotification } from '../services/notificationService';

interface AuthenticatedSocket extends Socket {
  userId?: bigint;
}

const connectedUsers = new Map<string, string[]>(); // userId -> socketId[]

export function setupChatHandlers(io: Server) {
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie
        ? parseCookie(socket.handshake.headers.cookie)
        : {};
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1] ||
        cookies.token;

      if (!token) {
        return next(new Error('No autorizado'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Token inválido'));
      }

      const user = await prisma.user.findUnique({
        where: { id: BigInt(decoded.userId) },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive || user.email !== decoded.email) {
        return next(new Error('Token invÃ¡lido'));
      }

      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Error de autenticación'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!.toString();
    console.log(`User ${userId} connected with socket ${socket.id}`);

    // Add socket to connected users
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, []);
    }
    connectedUsers.get(userId)!.push(socket.id);

    // Join conversation rooms for all user's conversations
    joinUserConversations(socket);

    // Handle joining a specific conversation
    socket.on('join:conversation', async (conversationId: string) => {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: BigInt(conversationId) },
          include: {
            participants: true,
          },
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversación no encontrada' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.userId === socket.userId
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'No tienes acceso a esta conversación' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} joined conversation:${conversationId}`);

        // Mark messages as read
        await prisma.message.updateMany({
          where: {
            conversationId: BigInt(conversationId),
            senderUserId: { not: socket.userId },
            isRead: false,
          },
          data: { isRead: true },
        });

        // Notify other participants that messages were read
        socket.to(`conversation:${conversationId}`).emit('messages:read', {
          conversationId,
          readBy: userId,
        });
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Error al unirse a la conversación' });
      }
    });

    // Handle sending a message
    socket.on('message:send', async (
      data: { conversationId: string; body: string },
      callback?: (response: { success: boolean; data?: any; error?: string }) => void
    ) => {
      try {
        const { conversationId, body } = data;

        if (!body?.trim()) {
          emitMessageError(socket, callback, 'El mensaje no puede estar vacio');
          return;
        }

        const conversation = await prisma.conversation.findUnique({
          where: { id: BigInt(conversationId) },
          include: {
            participants: true,
            ad: {
              select: {
                title: true,
              },
            },
          },
        });

        if (!conversation) {
          emitMessageError(socket, callback, 'Conversacion no encontrada');
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.userId === socket.userId
        );

        if (!isParticipant) {
          emitMessageError(socket, callback, 'No tienes acceso a esta conversacion');
          return;
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            conversationId: BigInt(conversationId),
            senderUserId: socket.userId!,
            body: body.trim(),
          },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        });

        const serializedMessage = {
          id: message.id.toString(),
          conversationId: message.conversationId.toString(),
          senderUserId: message.senderUserId.toString(),
          body: message.body,
          isRead: message.isRead,
          sentAt: message.sentAt.toISOString(),
          sender: {
            id: message.sender.id.toString(),
            fullName: message.sender.fullName,
            avatarUrl: message.sender.avatarUrl,
          },
        };

        // Emit to all participants in the conversation
        io.to(`conversation:${conversationId}`).emit('message:new', serializedMessage);
        callback?.({ success: true, data: serializedMessage });

        // Send notifications to offline participants
        const otherParticipants = conversation.participants.filter(
          (p) => p.userId !== socket.userId
        );

        for (const participant of otherParticipants) {
          const participantSockets = connectedUsers.get(participant.userId.toString());
          const isOnline = participantSockets && participantSockets.length > 0;

          // Check if participant is in the conversation room
          const roomSockets = io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
          const isInRoom = roomSockets && participantSockets?.some(s => roomSockets.has(s));

          if (!isInRoom) {
            // Create notification for offline or not in room users
            const senderName = message.sender.fullName;
            const adTitle = conversation.ad?.title || 'una conversación';

            await createNotification(
              participant.userId,
              'Nuevo mensaje',
              `${senderName} te ha enviado un mensaje en "${adTitle}"`,
              'message_new'
            );

            // Emit unread count update to user's other sockets
            for (const socketId of participantSockets || []) {
              io.to(socketId).emit('unread:update');
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        emitMessageError(socket, callback, 'Error al enviar el mensaje');
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userId,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId,
      });
    });

    // Handle leaving a conversation
    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} left conversation:${conversationId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected socket ${socket.id}`);

      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index > -1) {
          userSockets.splice(index, 1);
        }
        if (userSockets.length === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });
}

async function joinUserConversations(socket: AuthenticatedSocket) {
  try {
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId: socket.userId },
      select: { conversationId: true },
    });

    for (const participation of participations) {
      socket.join(`conversation:${participation.conversationId}`);
    }
  } catch (error) {
    console.error('Error joining user conversations:', error);
  }
}

function emitMessageError(
  socket: AuthenticatedSocket,
  callback: ((response: { success: boolean; error?: string }) => void) | undefined,
  message: string
) {
  socket.emit('message:error', { message });
  callback?.({ success: false, error: message });
}

export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId) && connectedUsers.get(userId)!.length > 0;
}

export function getUserSocketIds(userId: string): string[] {
  return connectedUsers.get(userId) || [];
}
