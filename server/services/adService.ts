import prisma from '../config/database';
import type { AdFiltersInput, CreateAdInput, UpdateAdInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';
import { createAuditLog } from './auditService';

export async function createAd(userId: bigint, data: CreateAdInput) {
  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: BigInt(data.categoryId) },
  });

  if (!category) {
    throw new AppError('Categoría no encontrada', 404);
  }

  const ad = await prisma.ad.create({
    data: {
      userId,
      categoryId: BigInt(data.categoryId),
      title: data.title,
      description: data.description,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      modality: data.modality,
      location: data.location,
      status: data.status || 'active',
    },
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
      images: true,
    },
  });

  await createAuditLog(userId, 'CREATE', 'Ad', ad.id, `Anuncio creado: ${ad.title}`);

  return ad;
}

export async function updateAd(adId: bigint, userId: bigint, data: UpdateAdInput, isAdmin: boolean = false) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  if (ad.userId !== userId && !isAdmin) {
    throw new AppError('No tienes permisos para editar este anuncio', 403);
  }

  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      categoryId: data.categoryId ? BigInt(data.categoryId) : undefined,
      title: data.title,
      description: data.description,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      modality: data.modality,
      location: data.location,
      status: data.status,
    },
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
      images: true,
    },
  });

  await createAuditLog(userId, 'UPDATE', 'Ad', adId, `Anuncio actualizado: ${updatedAd.title}`);

  return updatedAd;
}

export async function deleteAd(adId: bigint, userId: bigint, isAdmin: boolean = false) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  if (ad.userId !== userId && !isAdmin) {
    throw new AppError('No tienes permisos para eliminar este anuncio', 403);
  }

  await prisma.ad.delete({
    where: { id: adId },
  });

  await createAuditLog(userId, 'DELETE', 'Ad', adId, `Anuncio eliminado: ${ad.title}`);

  return { success: true };
}

export async function getAdById(adId: bigint, userId?: bigint) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    include: {
      category: true,
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          city: true,
          createdAt: true,
        },
      },
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  // Check if user has favorited this ad
  let isFavorited = false;
  if (userId) {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_adId: {
          userId,
          adId,
        },
      },
    });
    isFavorited = !!favorite;
  }

  // Check if user has already applied
  let hasApplied = false;
  if (userId) {
    const application = await prisma.application.findFirst({
      where: {
        adId,
        professionalUserId: userId,
      },
    });
    hasApplied = !!application;
  }

  return {
    ...ad,
    isFavorited,
    hasApplied,
  };
}

export async function listAds(filters: AdFiltersInput): Promise<PaginatedResponse<any>> {
  const where: any = {};

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
      { location: { contains: filters.search } },
    ];
  }

  if (filters.categoryId) {
    where.categoryId = BigInt(filters.categoryId);
  }

  if (filters.modality) {
    where.modality = filters.modality;
  }

  if (filters.location) {
    where.location = { contains: filters.location };
  }

  if (filters.status) {
    where.status = filters.status;
  } else {
    // By default, only show active ads
    where.status = 'active';
  }

  if (filters.budgetMin !== undefined) {
    where.budgetMax = { gte: filters.budgetMin };
  }

  if (filters.budgetMax !== undefined) {
    where.budgetMin = { lte: filters.budgetMax };
  }

  let orderBy: any = { createdAt: 'desc' };
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'budget_asc':
        orderBy = { budgetMin: 'asc' };
        break;
      case 'budget_desc':
        orderBy = { budgetMax: 'desc' };
        break;
    }
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 12;

  const [items, total] = await Promise.all([
    prisma.ad.findMany({
      where,
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
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ad.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserAds(
  userId: bigint,
  page: number = 1,
  pageSize: number = 12,
  status?: string
) {
  const where: any = { userId };

  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      include: {
        category: true,
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
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ad.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function addAdImage(adId: bigint, userId: bigint, imageUrl: string, isMain: boolean = false) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  if (ad.userId !== userId) {
    throw new AppError('No tienes permisos para modificar este anuncio', 403);
  }

  // If this is main, unset other main images
  if (isMain) {
    await prisma.adImage.updateMany({
      where: { adId },
      data: { isMain: false },
    });
  }

  const image = await prisma.adImage.create({
    data: {
      adId,
      imageUrl,
      isMain,
    },
  });

  return image;
}

export async function deleteAdImage(imageId: bigint, userId: bigint) {
  const image = await prisma.adImage.findUnique({
    where: { id: imageId },
    include: {
      ad: true,
    },
  });

  if (!image) {
    throw new AppError('Imagen no encontrada', 404);
  }

  if (image.ad.userId !== userId) {
    throw new AppError('No tienes permisos para eliminar esta imagen', 403);
  }

  await prisma.adImage.delete({
    where: { id: imageId },
  });

  return { success: true };
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  });
}

export async function getCategoryById(categoryId: bigint) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw new AppError('Categoría no encontrada', 404);
  }

  return category;
}

// Admin functions
export async function createCategory(name: string, description?: string) {
  return prisma.category.create({
    data: {
      name,
      description,
    },
  });
}

export async function updateCategory(categoryId: bigint, name: string, description?: string) {
  return prisma.category.update({
    where: { id: categoryId },
    data: {
      name,
      description,
    },
  });
}

export async function deleteCategory(categoryId: bigint) {
  // Check if there are ads using this category
  const adsCount = await prisma.ad.count({
    where: { categoryId },
  });

  if (adsCount > 0) {
    throw new AppError('No se puede eliminar una categoría que tiene anuncios asociados', 400);
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });

  return { success: true };
}

export async function listAllAds(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  status?: string,
  categoryId?: string
): Promise<PaginatedResponse<any>> {
  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (categoryId) {
    where.categoryId = BigInt(categoryId);
  }

  const [items, total] = await Promise.all([
    prisma.ad.findMany({
      where,
      include: {
        category: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ad.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function updateAdStatus(adId: bigint, status: string, userId: bigint) {
  const ad = await prisma.ad.update({
    where: { id: adId },
    data: { status },
  });

  await createAuditLog(userId, 'UPDATE_STATUS', 'Ad', adId, `Estado cambiado a: ${status}`);

  return ad;
}
