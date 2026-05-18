import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import * as reviewService from '../services/reviewService';
import { createReviewSchema } from '../utils/validation';

const router = Router();

// Create review
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createReviewSchema.parse(req.body);
    const review = await reviewService.createReview(req.user!.id, data);
    res.status(201).json({
      success: true,
      data: serializeReview(review),
    });
  })
);

// Get reviews given by current user
router.get(
  '/given/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await reviewService.getReviewsGivenByUser(req.user!.id, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeReview),
      },
    });
  })
);

// Get reviews received by current user
router.get(
  '/received/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await reviewService.getUserReviews(req.user!.id, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeReview),
      },
    });
  })
);

// Get rating stats for a user
router.get(
  '/user/:userId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.userId);
    const stats = await reviewService.getUserRatingStats(userId);
    res.json({
      success: true,
      data: stats,
    });
  })
);

// Get reviews received by a user
router.get(
  '/user/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await reviewService.getUserReviews(userId, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeReview),
      },
    });
  })
);

// Get review by ID
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const reviewId = BigInt(req.params.id);
    const review = await reviewService.getReviewById(reviewId);
    res.json({
      success: true,
      data: serializeReview(review),
    });
  })
);

function serializeReview(review: any) {
  return {
    id: review.id.toString(),
    orderId: review.orderId.toString(),
    reviewerUserId: review.reviewerUserId.toString(),
    reviewedUserId: review.reviewedUserId.toString(),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reviewer: review.reviewer
      ? {
          id: review.reviewer.id.toString(),
          fullName: review.reviewer.fullName,
          avatarUrl: review.reviewer.avatarUrl,
        }
      : null,
    reviewed: review.reviewed
      ? {
          id: review.reviewed.id.toString(),
          fullName: review.reviewed.fullName,
        }
      : null,
    order: review.order
      ? {
          id: review.order.id.toString(),
          application: review.order.application
            ? {
                ad: review.order.application.ad
                  ? {
                      id: review.order.application.ad.id.toString(),
                      title: review.order.application.ad.title,
                    }
                  : null,
              }
            : null,
        }
      : null,
  };
}

export default router;
