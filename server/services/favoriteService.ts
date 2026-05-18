import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';

export async function addFavorite(userId: bigint, adId: bigint) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  // Check if already favorited
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_adId: {
        userId,
        adId,
      },
    },
  });

  if (existing) {
    throw new AppError('El anuncio ya está en favoritos', 409);
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      adId,
    },
  });

  return favorite;
}

export async function removeFavorite(userId: bigint, adId: bigint) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_adId: {
        userId,
        adId,
      },
    },
  });

  if (!favorite) {
    throw new AppError('El anuncio no está en favoritos', 404);
  }

  await prisma.favorite.delete({
    where: {
      userId_adId: {
        userId,
        adId,
      },
    },
  });

  return { success: true };
}

export async function getUserFavorites(
  userId: bigint,
  page: number = 1,
  pageSize: number = 12
): Promise<PaginatedResponse<any>> {
  const where = { userId };

  const [items, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      include: {
        ad: {
          include: {
            category: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                city: true,
              },
            },
            images: {
              where: { isMain: true },
              take: 1,
            },
            _count: {
              select: {
                applications: true,
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
    prisma.favorite.count({ where }),
  ]);

  return {
    items: items.map((fav) => ({
      ...fav.ad,
      favoritedAt: fav.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function checkIsFavorite(userId: bigint, adId: bigint): Promise<boolean> {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_adId: {
        userId,
        adId,
      },
    },
  });

  return !!favorite;
}

export async function toggleFavorite(userId: bigint, adId: bigint): Promise<{ isFavorited: boolean }> {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_adId: {
        userId,
        adId,
      },
    },
  });

  if (existing) {
    await prisma.favorite.delete({
      where: {
        userId_adId: {
          userId,
          adId,
        },
      },
    });
    return { isFavorited: false };
  } else {
    await prisma.favorite.create({
      data: {
        userId,
        adId,
      },
    });
    return { isFavorited: true };
  }
}
