import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as adService from '../services/adService';

const router = Router();

// Get all categories (public)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = await adService.getCategories();
    res.json({
      success: true,
      data: categories.map((cat) => ({
        id: cat.id.toString(),
        name: cat.name,
        description: cat.description,
      })),
    });
  })
);

// Get single category (public)
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = BigInt(req.params.id);
    const category = await adService.getCategoryById(categoryId);
    res.json({
      success: true,
      data: {
        id: category.id.toString(),
        name: category.name,
        description: category.description,
      },
    });
  })
);

export default router;
