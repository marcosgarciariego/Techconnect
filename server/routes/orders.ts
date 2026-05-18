import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import * as orderService from '../services/orderService';
import { createServiceOrderSchema, updateOrderStatusSchema } from '../utils/validation';

const router = Router();

// Create service order
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createServiceOrderSchema.parse(req.body);
    const order = await orderService.createServiceOrder(req.user!.id, data);
    res.status(201).json({
      success: true,
      data: serializeOrder(order),
    });
  })
);

// Get client's orders
router.get(
  '/client/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const result = await orderService.getClientOrders(req.user!.id, page, pageSize, status);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeOrder),
      },
    });
  })
);

// Get professional's orders
router.get(
  '/professional/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const result = await orderService.getProfessionalOrders(req.user!.id, page, pageSize, status);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeOrder),
      },
    });
  })
);

// Get order by ID
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = BigInt(req.params.id);
    const order = await orderService.getOrderById(orderId, req.user!.id);
    res.json({
      success: true,
      data: serializeOrder(order),
    });
  })
);

// Update order status
router.patch(
  '/:id/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = BigInt(req.params.id);
    const { status } = updateOrderStatusSchema.parse(req.body);
    const order = await orderService.updateOrderStatus(orderId, req.user!.id, status);
    res.json({
      success: true,
      data: serializeOrder(order),
    });
  })
);

function serializeOrder(order: any) {
  return {
    id: order.id.toString(),
    applicationId: order.applicationId.toString(),
    clientUserId: order.clientUserId.toString(),
    professionalUserId: order.professionalUserId.toString(),
    agreedPrice: parseFloat(order.agreedPrice.toString()),
    startDate: order.startDate,
    endDate: order.endDate,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    canReview: order.canReview,
    hasReviewed: order.hasReviewed,
    hasReview: order.hasReview ?? (order._count?.reviews ? order._count.reviews > 0 : false),
    application: order.application
      ? {
          id: order.application.id.toString(),
          coverLetter: order.application.coverLetter,
          proposedPrice: order.application.proposedPrice
            ? parseFloat(order.application.proposedPrice.toString())
            : null,
          estimatedDays: order.application.estimatedDays,
          status: order.application.status,
          ad: order.application.ad
            ? {
                id: order.application.ad.id.toString(),
                title: order.application.ad.title,
                description: order.application.ad.description,
                status: order.application.ad.status,
                category: order.application.ad.category
                  ? {
                      id: order.application.ad.category.id.toString(),
                      name: order.application.ad.category.name,
                    }
                  : null,
                images: order.application.ad.images?.map((img: any) => ({
                  id: img.id.toString(),
                  imageUrl: img.imageUrl,
                  isMain: img.isMain,
                })),
              }
            : null,
        }
      : null,
    client: order.client
      ? {
          id: order.client.id.toString(),
          fullName: order.client.fullName,
          email: order.client.email,
          phone: order.client.phone,
          avatarUrl: order.client.avatarUrl,
          city: order.client.city,
        }
      : null,
    professional: order.professional
      ? {
          id: order.professional.id.toString(),
          fullName: order.professional.fullName,
          email: order.professional.email,
          phone: order.professional.phone,
          avatarUrl: order.professional.avatarUrl,
          city: order.professional.city,
          professionalProfile: order.professional.professionalProfile
            ? {
                yearsExperience: order.professional.professionalProfile.yearsExperience,
                verified: order.professional.professionalProfile.verified,
              }
            : null,
        }
      : null,
    reviews: order.reviews?.map((r: any) => ({
      id: r.id.toString(),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewer: r.reviewer
        ? {
            id: r.reviewer.id.toString(),
            fullName: r.reviewer.fullName,
            avatarUrl: r.reviewer.avatarUrl,
          }
        : null,
    })),
    reviewsCount: order._count?.reviews || order.reviews?.length || 0,
  };
}

export default router;
