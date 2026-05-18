import prisma from '../config/database';
import type { CreateConversationInput, SendMessageInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';

export async function createConversation(userId: bigint, data: CreateConversationInput) {
  // Check if a conversation already exists for this context
  const existingConversation = await findExistingConversation(
    data.adId,
    data.applicationId,
    data.orderId,
    userId,
    data.participantIds
  );

  if (existingConversation) {
    return existingConversation;
  }

  const conversation = await prisma.conversation.create({
    data: {
      adId: data.adId ? BigInt(data.adId) : null,
      applicationId: data.applicationId ? BigInt(data.applicationId) : null,
      orderId: data.orderId ? BigInt(data.orderId) : null,
      participants: {
        create: [
          { userId },
          ...data.participantIds.map((id) => ({ userId: BigInt(id) })),
        ],
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      ad: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return conversation;
}

async function findExistingConversation(
  adId?: number,
  applicationId?: number,
  orderId?: number,
  userId?: bigint,
  participantIds?: number[]
) {
  const where: any = {};

  if (orderId) {
    where.orderId = BigInt(orderId);
  } else if (applicationId) {
    where.applicationId = BigInt(applicationId);
  } else if (adId && userId && participantIds?.length) {
    // Check for existing conversation between these users for this ad
    const conversations = await prisma.conversation.findMany({
      where: {
        adId: BigInt(adId),
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    for (const conv of conversations) {
      const participantUserIds = conv.participants.map((p) => p.userId.toString());
      const allParticipants = [userId.toString(), ...participantIds.map(String)];

      if (
        allParticipants.every((id) => participantUserIds.includes(id)) &&
        participantUserIds.length === allParticipants.length
      ) {
        return prisma.conversation.findUnique({
          where: { id: conv.id },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            ad: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });
      }
    }
  }

  if (Object.keys(where).length === 0) {
    return null;
  }

  return prisma.conversation.findFirst({
    where,
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      ad: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

export async function getConversationById(conversationId: bigint, userId: bigint) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      ad: {
        select: {
          id: true,
          title: true,
        },
      },
      application: {
        select: {
          id: true,
          status: true,
        },
      },
      order: {
        select: {
          id: true,
          status: true,
        },
      },
      messages: {
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          sentAt: 'asc',
        },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversación no encontrada', 404);
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    (p) => p.userId === userId
  );

  if (!isParticipant) {
    throw new AppError('No tienes acceso a esta conversación', 403);
  }

  // Mark messages as read
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderUserId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return conversation;
}

export async function getUserConversations(
  userId: bigint,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<any>> {
  // First get conversation IDs where user is participant
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const conversationIds = participations.map((p) => p.conversationId);

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        ad: {
          select: {
            id: true,
            title: true,
          },
        },
        messages: {
          orderBy: {
            sentAt: 'desc',
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({
      where: {
        id: { in: conversationIds },
      },
    }),
  ]);

  // Get unread count for each conversation
  const itemsWithUnread = await Promise.all(
    items.map(async (conv) => {
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderUserId: { not: userId },
          isRead: false,
        },
      });

      return {
        ...conv,
        lastMessage: conv.messages[0] || null,
        unreadCount,
      };
    })
  );

  // Sort by last message date
  itemsWithUnread.sort((a, b) => {
    const aDate = a.lastMessage?.sentAt || a.createdAt;
    const bDate = b.lastMessage?.sentAt || b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return {
    items: itemsWithUnread,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function sendMessage(userId: bigint, data: SendMessageInput) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: BigInt(data.conversationId) },
    include: {
      participants: true,
    },
  });

  if (!conversation) {
    throw new AppError('Conversación no encontrada', 404);
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    (p) => p.userId === userId
  );

  if (!isParticipant) {
    throw new AppError('No tienes acceso a esta conversación', 403);
  }

  const message = await prisma.message.create({
    data: {
      conversationId: BigInt(data.conversationId),
      senderUserId: userId,
      body: data.body,
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

  return message;
}

export async function markMessagesAsRead(conversationId: bigint, userId: bigint) {
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderUserId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
}

export async function getUnreadCount(userId: bigint): Promise<number> {
  // Get all conversations where user is participant
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const conversationIds = participations.map((p) => p.conversationId);

  return prisma.message.count({
    where: {
      conversationId: { in: conversationIds },
      senderUserId: { not: userId },
      isRead: false,
    },
  });
}

export async function getOrCreateConversationForApplication(
  applicationId: bigint,
  userId: bigint
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      ad: true,
    },
  });

  if (!application) {
    throw new AppError('Candidatura no encontrada', 404);
  }

  // Check if user is part of this application
  if (application.professionalUserId !== userId && application.ad.userId !== userId) {
    throw new AppError('No tienes acceso a esta conversación', 403);
  }

  // Find or create conversation
  let conversation = await prisma.conversation.findFirst({
    where: { applicationId },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      messages: {
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          sentAt: 'asc',
        },
      },
      ad: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        applicationId,
        adId: application.adId,
        participants: {
          create: [
            { userId: application.professionalUserId },
            { userId: application.ad.userId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            sentAt: 'asc',
          },
        },
        ad: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  return conversation;
}
