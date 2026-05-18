import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import * as notificationService from '../services/notificationService';

const router = Router();

// Get user's notifications
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await notificationService.getUserNotifications(
      req.user!.id,
      page,
      pageSize,
      unreadOnly
    );
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeNotification),
      },
    });
  })
);

// Get unread count
router.get(
  '/unread/count',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationService.getUnreadNotificationCount(req.user!.id);
    res.json({
      success: true,
      data: { count },
    });
  })
);

// Mark notification as read
router.patch(
  '/:id/read',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const notificationId = BigInt(req.params.id);
    const notification = await notificationService.markNotificationAsRead(
      notificationId,
      req.user!.id
    );
    if (!notification) {
      res.status(404).json({
        success: false,
        error: 'Notificación no encontrada',
      });
      return;
    }
    res.json({
      success: true,
      data: serializeNotification(notification),
    });
  })
);

// Mark all notifications as read
router.post(
  '/read-all',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllNotificationsAsRead(req.user!.id);
    res.json({
      success: true,
      message: 'Todas las notificaciones han sido marcadas como leídas',
    });
  })
);

// Delete notification
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const notificationId = BigInt(req.params.id);
    const result = await notificationService.deleteNotification(notificationId, req.user!.id);
    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Notificación no encontrada',
      });
      return;
    }
    res.json({
      success: true,
      message: 'Notificación eliminada',
    });
  })
);

function serializeNotification(notification: any) {
  return {
    id: notification.id.toString(),
    userId: notification.userId.toString(),
    title: notification.title,
    body: notification.body,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

export default router;
