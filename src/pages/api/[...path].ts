import type { APIRoute } from 'astro';
import { Prisma, type Ad, type AdImage, type Category, type User } from '@prisma/client';
import { ZodError } from 'zod';

import * as adService from '../../../server/services/adService';
import { AppError } from '../../../server/middleware/errorHandler';
import { adFiltersSchema } from '../../../server/utils/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    if (pathname === '/health') {
      return json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      });
    }

    if (pathname === '/ads') {
      const filters = adFiltersSchema.parse(Object.fromEntries(url.searchParams));
      const result = await adService.listAds(filters);

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeAd),
        },
      });
    }

    const adMatch = pathname.match(/^\/ads\/([^/]+)$/);
    if (adMatch) {
      const ad = await adService.getAdById(BigInt(adMatch[1]));

      return json({
        success: true,
        data: serializeAd(ad),
      });
    }

    if (pathname === '/categories') {
      const categories = await adService.getCategories();

      return json({
        success: true,
        data: categories.map(serializeCategory),
      });
    }

    const categoryMatch = pathname.match(/^\/categories\/([^/]+)$/);
    if (categoryMatch) {
      const category = await adService.getCategoryById(BigInt(categoryMatch[1]));

      return json({
        success: true,
        data: serializeCategory(category),
      });
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

function normalizeApiPath(pathname: string): string {
  return pathname.replace(/^\/api/, '') || '/';
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function handleApiError(error: unknown): Response {
  console.error(error);

  if (error instanceof ZodError) {
    return json({
      success: false,
      error: 'Error de validacion',
      details: error.errors.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    }, 400);
  }

  if (error instanceof AppError) {
    return json({
      success: false,
      error: error.message,
    }, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return json({
      success: false,
      error: 'Error de base de datos',
      code: error.code,
    }, 500);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return json({
      success: false,
      error: 'No se pudo inicializar Prisma. Revisa DATABASE_URL en Vercel y que la base de datos sea accesible desde internet.',
    }, 500);
  }

  return json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? undefined : getErrorMessage(error),
  }, 500);
}

type SerializedAdInput = Ad & {
  category?: Category | null;
  user?: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'city' | 'createdAt'> | null;
  images?: AdImage[];
  _count?: {
    applications?: number;
  };
  isFavorited?: boolean;
  hasApplied?: boolean;
};

function serializeAd(ad: SerializedAdInput) {
  return {
    id: ad.id.toString(),
    userId: ad.userId.toString(),
    categoryId: ad.categoryId.toString(),
    title: ad.title,
    description: ad.description,
    budgetMin: ad.budgetMin ? parseFloat(ad.budgetMin.toString()) : null,
    budgetMax: ad.budgetMax ? parseFloat(ad.budgetMax.toString()) : null,
    modality: ad.modality,
    location: ad.location,
    status: ad.status,
    publishedAt: ad.publishedAt,
    expiresAt: ad.expiresAt,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    category: ad.category ? serializeCategory(ad.category) : null,
    user: ad.user
      ? {
          id: ad.user.id.toString(),
          fullName: ad.user.fullName,
          avatarUrl: ad.user.avatarUrl,
          city: ad.user.city,
          createdAt: ad.user.createdAt,
        }
      : null,
    images: ad.images?.map((image) => ({
      id: image.id.toString(),
      imageUrl: image.imageUrl,
      isMain: image.isMain,
      sortOrder: image.sortOrder,
    })),
    applicationsCount: ad._count?.applications || 0,
    isFavorited: ad.isFavorited || false,
    hasApplied: ad.hasApplied || false,
  };
}

function serializeCategory(category: Category) {
  return {
    id: category.id.toString(),
    name: category.name,
    description: category.description,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
