import prisma from '../config/database';
import type { PaginatedResponse } from '../types';

export async function createNotification(
  userId: bigint,
  title: string,
  body: string,
  type: string
) {
  return prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
    },
  });
}

export async function getUserNotifications(
  userId: bigint,
  page: number = 1,
  pageSize: number = 20,
  unreadOnly: boolean = false
): Promise<PaginatedResponse<any>> {
  const where: any = { userId };

  if (unreadOnly) {
    where.isRead = false;
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function markNotificationAsRead(notificationId: bigint, userId: bigint) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return null;
  }

  if (notification.userId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(userId: bigint) {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
}

export async function getUnreadNotificationCount(userId: bigint): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function deleteNotification(notificationId: bigint, userId: bigint) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { success: true };
}
