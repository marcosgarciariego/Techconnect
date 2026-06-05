import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/roles';
import * as favoriteService from '../services/favoriteService';

const router = Router();

// Get user's favorites
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    const result = await favoriteService.getUserFavorites(req.user!.id, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeAd),
      },
    });
  })
);

// Add favorite
router.post(
  '/:adId',
  authMiddleware,
  requireRoles('client', 'professional'),
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.adId);
    await favoriteService.addFavorite(req.user!.id, adId);
    res.status(201).json({
      success: true,
      message: 'Anuncio añadido a favoritos',
    });
  })
);

// Remove favorite
router.delete(
  '/:adId',
  authMiddleware,
  requireRoles('client', 'professional'),
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.adId);
    await favoriteService.removeFavorite(req.user!.id, adId);
    res.json({
      success: true,
      message: 'Anuncio eliminado de favoritos',
    });
  })
);

// Toggle favorite
router.post(
  '/:adId/toggle',
  authMiddleware,
  requireRoles('client', 'professional'),
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.adId);
    const result = await favoriteService.toggleFavorite(req.user!.id, adId);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Check if ad is favorited
router.get(
  '/:adId/check',
  authMiddleware,
  requireRoles('client', 'professional'),
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.adId);
    const isFavorited = await favoriteService.checkIsFavorite(req.user!.id, adId);
    res.json({
      success: true,
      data: { isFavorited },
    });
  })
);

function serializeAd(ad: any) {
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
    createdAt: ad.createdAt,
    favoritedAt: ad.favoritedAt,
    category: ad.category
      ? {
          id: ad.category.id.toString(),
          name: ad.category.name,
        }
      : null,
    user: ad.user
      ? {
          id: ad.user.id.toString(),
          fullName: ad.user.fullName,
          avatarUrl: ad.user.avatarUrl,
          city: ad.user.city,
        }
      : null,
    images: ad.images?.map((img: any) => ({
      id: img.id.toString(),
      imageUrl: img.imageUrl,
      isMain: img.isMain,
    })),
    applicationsCount: ad._count?.applications || 0,
  };
}

export default router;
