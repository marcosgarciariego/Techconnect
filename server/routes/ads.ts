import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { requireClient } from '../middleware/roles';
import * as adService from '../services/adService';
import { createAdSchema, updateAdSchema, adFiltersSchema } from '../utils/validation';

const router = Router();

// List ads with filters (public)
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const filters = adFiltersSchema.parse(req.query);
    const result = await adService.listAds(filters);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeAd),
      },
    });
  })
);

// Get user's ads
router.get(
  '/user/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    const status = req.query.status as string | undefined;
    const result = await adService.getUserAds(req.user!.id, page, pageSize, status);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeAd),
      },
    });
  })
);

// Get single ad (public)
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    const userId = req.user?.id;
    const ad = await adService.getAdById(adId, userId);
    res.json({
      success: true,
      data: serializeAd(ad),
    });
  })
);

// Create ad (client only)
router.post(
  '/',
  authMiddleware,
  requireClient,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createAdSchema.parse(req.body);
    const ad = await adService.createAd(req.user!.id, data);
    res.status(201).json({
      success: true,
      data: serializeAd(ad),
    });
  })
);

// Update ad
router.put(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    const data = updateAdSchema.parse(req.body);
    const isAdmin = req.user!.roles.includes('admin');
    const ad = await adService.updateAd(adId, req.user!.id, data, isAdmin);
    res.json({
      success: true,
      data: serializeAd(ad),
    });
  })
);

// Delete ad
router.delete(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    const isAdmin = req.user!.roles.includes('admin');
    await adService.deleteAd(adId, req.user!.id, isAdmin);
    res.json({
      success: true,
      message: 'Anuncio eliminado correctamente',
    });
  })
);

// Add image to ad
router.post(
  '/:id/images',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    const { imageUrl, isMain } = req.body;
    const image = await adService.addAdImage(adId, req.user!.id, imageUrl, isMain);
    res.status(201).json({
      success: true,
      data: {
        id: image.id.toString(),
        adId: image.adId.toString(),
        imageUrl: image.imageUrl,
        isMain: image.isMain,
        sortOrder: image.sortOrder,
      },
    });
  })
);

// Delete image from ad
router.delete(
  '/images/:imageId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const imageId = BigInt(req.params.imageId);
    await adService.deleteAdImage(imageId, req.user!.id);
    res.json({
      success: true,
      message: 'Imagen eliminada correctamente',
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
    publishedAt: ad.publishedAt,
    expiresAt: ad.expiresAt,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    category: ad.category
      ? {
          id: ad.category.id.toString(),
          name: ad.category.name,
          description: ad.category.description,
        }
      : null,
    user: ad.user
      ? {
          id: ad.user.id.toString(),
          fullName: ad.user.fullName,
          avatarUrl: ad.user.avatarUrl,
          city: ad.user.city,
          createdAt: ad.user.createdAt,
        }
      : null,
    images: ad.images?.map((img: any) => ({
      id: img.id.toString(),
      imageUrl: img.imageUrl,
      isMain: img.isMain,
      sortOrder: img.sortOrder,
    })),
    applicationsCount: ad._count?.applications || 0,
    isFavorited: ad.isFavorited || false,
    hasApplied: ad.hasApplied || false,
  };
}

export default router;
