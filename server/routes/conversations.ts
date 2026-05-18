import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import * as conversationService from '../services/conversationService';
import { sendMessageSchema, createConversationSchema } from '../utils/validation';

const router = Router();

// Create conversation
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createConversationSchema.parse(req.body);
    const conversation = await conversationService.createConversation(req.user!.id, data);
    res.status(201).json({
      success: true,
      data: serializeConversation(conversation),
    });
  })
);

// Get user's conversations
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await conversationService.getUserConversations(req.user!.id, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeConversation),
      },
    });
  })
);

// Get unread count
router.get(
  '/unread/count',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await conversationService.getUnreadCount(req.user!.id);
    res.json({
      success: true,
      data: { count },
    });
  })
);

// Get or create conversation for application
router.get(
  '/application/:applicationId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = BigInt(req.params.applicationId);
    const conversation = await conversationService.getOrCreateConversationForApplication(
      applicationId,
      req.user!.id
    );
    res.json({
      success: true,
      data: serializeConversation(conversation),
    });
  })
);

// Get conversation by ID
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const conversationId = BigInt(req.params.id);
    const conversation = await conversationService.getConversationById(conversationId, req.user!.id);
    res.json({
      success: true,
      data: serializeConversation(conversation),
    });
  })
);

// Mark messages as read
router.post(
  '/:id/read',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const conversationId = BigInt(req.params.id);
    await conversationService.markMessagesAsRead(conversationId, req.user!.id);
    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  })
);

// Send message
router.post(
  '/:id/messages',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const conversationId = BigInt(req.params.id);
    const { body } = sendMessageSchema.parse({
      conversationId: Number(conversationId),
      body: req.body.body,
    });
    const message = await conversationService.sendMessage(req.user!.id, {
      conversationId: Number(conversationId),
      body,
    });
    res.status(201).json({
      success: true,
      data: serializeMessage(message),
    });
  })
);

function serializeConversation(conv: any) {
  return {
    id: conv.id.toString(),
    adId: conv.adId?.toString() || null,
    applicationId: conv.applicationId?.toString() || null,
    orderId: conv.orderId?.toString() || null,
    createdAt: conv.createdAt,
    ad: conv.ad
      ? {
          id: conv.ad.id.toString(),
          title: conv.ad.title,
        }
      : null,
    application: conv.application
      ? {
          id: conv.application.id.toString(),
          status: conv.application.status,
        }
      : null,
    order: conv.order
      ? {
          id: conv.order.id.toString(),
          status: conv.order.status,
        }
      : null,
    participants: conv.participants?.map((p: any) => ({
      userId: p.userId.toString(),
      joinedAt: p.joinedAt,
      user: p.user
        ? {
            id: p.user.id.toString(),
            fullName: p.user.fullName,
            avatarUrl: p.user.avatarUrl,
          }
        : null,
    })),
    messages: conv.messages?.map(serializeMessage),
    lastMessage: conv.lastMessage ? serializeMessage(conv.lastMessage) : null,
    unreadCount: conv.unreadCount || 0,
  };
}

function serializeMessage(msg: any) {
  return {
    id: msg.id.toString(),
    conversationId: msg.conversationId.toString(),
    senderUserId: msg.senderUserId.toString(),
    body: msg.body,
    isRead: msg.isRead,
    sentAt: msg.sentAt,
    sender: msg.sender
      ? {
          id: msg.sender.id.toString(),
          fullName: msg.sender.fullName,
          avatarUrl: msg.sender.avatarUrl,
        }
      : null,
  };
}

export default router;
