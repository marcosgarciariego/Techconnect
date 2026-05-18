import prisma from '../config/database';
import type { CreateServiceOrderInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';
import { createAuditLog } from './auditService';
import { createNotification } from './notificationService';

export async function createServiceOrder(userId: bigint, data: CreateServiceOrderInput) {
  const application = await prisma.application.findUnique({
    where: { id: BigInt(data.applicationId) },
    include: {
      ad: true,
      professional: true,
      serviceOrder: true,
    },
  });

  if (!application) {
    throw new AppError('Candidatura no encontrada', 404);
  }

  if (application.ad.userId !== userId) {
    throw new AppError('Solo el dueño del anuncio puede crear una orden', 403);
  }

  if (application.status !== 'accepted') {
    throw new AppError('La candidatura debe estar aceptada para crear una orden', 400);
  }

  if (application.serviceOrder) {
    throw new AppError('Ya existe una orden de servicio para esta candidatura', 409);
  }

  const order = await prisma.serviceOrder.create({
    data: {
      applicationId: BigInt(data.applicationId),
      clientUserId: userId,
      professionalUserId: application.professionalUserId,
      agreedPrice: data.agreedPrice,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: 'active',
    },
    include: {
      application: {
        include: {
          ad: {
            include: {
              category: true,
            },
          },
        },
      },
      client: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Create notification for professional
  await createNotification(
    application.professionalUserId,
    'Nueva orden de servicio',
    `Se ha creado una orden de servicio para "${application.ad.title}"`,
    'order_new'
  );

  await createAuditLog(userId, 'CREATE', 'ServiceOrder', order.id, `Orden de servicio creada para: ${application.ad.title}`);

  return order;
}

export async function getOrderById(orderId: bigint, userId: bigint) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      application: {
        include: {
          ad: {
            include: {
              category: true,
              images: true,
            },
          },
        },
      },
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          city: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          city: true,
          professionalProfile: true,
        },
      },
      reviews: {
        include: {
          reviewer: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Orden no encontrada', 404);
  }

  // Check permissions
  if (order.clientUserId !== userId && order.professionalUserId !== userId) {
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      throw new AppError('No tienes permisos para ver esta orden', 403);
    }
  }

  // Check if current user can leave a review
  const existingReview = await prisma.review.findFirst({
    where: {
      orderId,
      reviewerUserId: userId,
    },
  });

  return {
    ...order,
    canReview: order.status === 'completed' && !existingReview,
    hasReviewed: !!existingReview,
  };
}

export async function updateOrderStatus(orderId: bigint, userId: bigint, status: string) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      application: {
        include: {
          ad: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Orden no encontrada', 404);
  }

  // Only client and professional of this order can update status
  if (order.clientUserId !== userId && order.professionalUserId !== userId) {
    throw new AppError('No tienes permisos para modificar esta orden', 403);
  }

  const updatedOrder = await prisma.serviceOrder.update({
    where: { id: orderId },
    data: { status },
    include: {
      application: {
        include: {
          ad: true,
        },
      },
      client: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Update ad status if order is completed
  if (status === 'completed') {
    await prisma.ad.update({
      where: { id: order.application.adId },
      data: { status: 'closed' },
    });

    // Notify both parties
    const title = order.application.ad.title;

    if (userId === order.clientUserId) {
      await createNotification(
        order.professionalUserId,
        'Orden completada',
        `La orden para "${title}" ha sido marcada como completada`,
        'order_completed'
      );
    } else {
      await createNotification(
        order.clientUserId,
        'Orden completada',
        `La orden para "${title}" ha sido marcada como completada`,
        'order_completed'
      );
    }
  }

  await createAuditLog(userId, 'UPDATE_STATUS', 'ServiceOrder', orderId, `Estado cambiado a: ${status}`);

  return updatedOrder;
}

export async function getClientOrders(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10,
  status?: string
): Promise<PaginatedResponse<any>> {
  const where: any = { clientUserId: userId };

  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      include: {
        application: {
          include: {
            ad: {
              include: {
                category: true,
                images: {
                  where: { isMain: true },
                  take: 1,
                },
              },
            },
          },
        },
        professional: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            city: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
        reviews: {
          where: {
            reviewerUserId: userId,
          },
          select: {
            id: true,
            reviewerUserId: true,
            reviewedUserId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  return {
    items: items.map((order) => ({
      ...order,
      hasReviewed: order.reviews.length > 0,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProfessionalOrders(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10,
  status?: string
): Promise<PaginatedResponse<any>> {
  const where: any = { professionalUserId: userId };

  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      include: {
        application: {
          include: {
            ad: {
              include: {
                category: true,
                images: {
                  where: { isMain: true },
                  take: 1,
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            city: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
        reviews: {
          where: {
            reviewerUserId: userId,
          },
          select: {
            id: true,
            reviewerUserId: true,
            reviewedUserId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.serviceOrder.count({ where }),
  ]);

  return {
    items: items.map((order) => ({
      ...order,
      hasReview: order._count.reviews > 0,
      hasReviewed: order.reviews.length > 0,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function checkIsAdmin(userId: bigint): Promise<boolean> {
  const adminRole = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        name: 'admin',
      },
    },
  });

  return !!adminRole;
}
