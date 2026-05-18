import prisma from '../config/database';
import type { CreateReviewInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';
import { createNotification } from './notificationService';

export async function createReview(userId: bigint, data: CreateReviewInput) {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: BigInt(data.orderId) },
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

  // Check if order is completed
  if (order.status !== 'completed') {
    throw new AppError('Solo puedes valorar órdenes completadas', 400);
  }

  // Check if user is part of this order
  if (order.clientUserId !== userId && order.professionalUserId !== userId) {
    throw new AppError('No tienes permisos para valorar esta orden', 403);
  }

  // Check if user is trying to review themselves
  if (BigInt(data.reviewedUserId) === userId) {
    throw new AppError('No puedes valorarte a ti mismo', 400);
  }

  // Check if reviewed user is part of this order
  const reviewedUserId = BigInt(data.reviewedUserId);
  if (reviewedUserId !== order.clientUserId && reviewedUserId !== order.professionalUserId) {
    throw new AppError('El usuario a valorar no forma parte de esta orden', 400);
  }

  // Check if already reviewed this user for this order
  const existingReview = await prisma.review.findFirst({
    where: {
      orderId: BigInt(data.orderId),
      reviewerUserId: userId,
      reviewedUserId: BigInt(data.reviewedUserId),
    },
  });

  if (existingReview) {
    throw new AppError('Ya has valorado a este usuario para esta orden', 409);
  }

  const review = await prisma.review.create({
    data: {
      orderId: BigInt(data.orderId),
      reviewerUserId: userId,
      reviewedUserId: BigInt(data.reviewedUserId),
      rating: data.rating,
      comment: data.comment,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      reviewed: {
        select: {
          id: true,
          fullName: true,
        },
      },
      order: {
        include: {
          application: {
            include: {
              ad: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Create notification for reviewed user
  await createNotification(
    BigInt(data.reviewedUserId),
    'Nueva valoración recibida',
    `${review.reviewer.fullName} te ha dejado una valoración de ${data.rating} estrellas`,
    'review_new'
  );

  return review;
}

export async function getReviewById(reviewId: bigint) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      reviewer: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      reviewed: {
        select: {
          id: true,
          fullName: true,
        },
      },
      order: {
        include: {
          application: {
            include: {
              ad: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!review) {
    throw new AppError('Valoración no encontrada', 404);
  }

  return review;
}

export async function getUserReviews(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<any>> {
  const where = { reviewedUserId: userId };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        order: {
          include: {
            application: {
              include: {
                ad: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
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
    prisma.review.count({ where }),
  ]);

  // Calculate average rating
  const stats = await prisma.review.aggregate({
    where: { reviewedUserId: userId },
    _avg: { rating: true },
    _count: true,
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserRatingStats(userId: bigint) {
  const stats = await prisma.review.aggregate({
    where: { reviewedUserId: userId },
    _avg: { rating: true },
    _count: true,
  });

  // Get rating distribution
  const distribution = await prisma.review.groupBy({
    by: ['rating'],
    where: { reviewedUserId: userId },
    _count: true,
  });

  const ratingDistribution: { [key: number]: number } = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  distribution.forEach((d) => {
    ratingDistribution[d.rating] = d._count;
  });

  return {
    averageRating: stats._avg.rating || 0,
    totalReviews: stats._count,
    distribution: ratingDistribution,
  };
}

export async function getReviewsGivenByUser(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<any>> {
  const where = { reviewerUserId: userId };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        reviewed: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        order: {
          include: {
            application: {
              include: {
                ad: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
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
    prisma.review.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
