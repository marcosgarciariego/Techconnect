import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { requireProfessional } from '../middleware/roles';
import * as userService from '../services/userService';
import { updateProfileSchema, updateProfessionalProfileSchema } from '../utils/validation';

const router = Router();

// Get current user profile
router.get(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.user!.id);
    res.json({
      success: true,
      data: serializeUser(user),
    });
  })
);

// Update current user profile
router.put(
  '/profile',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateProfileSchema.parse(req.body);
    const user = await userService.updateProfile(req.user!.id, data);
    res.json({
      success: true,
      data: serializeUser(user),
    });
  })
);

// Get professional profile
router.get(
  '/professional/me',
  authMiddleware,
  requireProfessional,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.getProfessionalProfile(req.user!.id);
    res.json({
      success: true,
      data: serializeProfessionalProfile(profile),
    });
  })
);

// Update professional profile
router.put(
  '/professional/me',
  authMiddleware,
  requireProfessional,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateProfessionalProfileSchema.parse(req.body);
    const profile = await userService.updateProfessionalProfile(req.user!.id, data);
    res.json({
      success: true,
      data: serializeProfessionalProfile(profile),
    });
  })
);

// List professionals
router.get(
  '/professionals/list',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    const search = req.query.search as string;
    const availability = req.query.availability as string;

    const result = await userService.listProfessionals(page, pageSize, search, availability);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializePublicProfile),
      },
    });
  })
);

// Get public profile by ID
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.id);
    const profile = await userService.getPublicProfile(userId);
    res.json({
      success: true,
      data: serializePublicProfile(profile),
    });
  })
);

function serializeUser(user: any) {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles?.map((ur: any) => ur.role.name) || user.roles || [],
    professionalProfile: user.professionalProfile
      ? serializeProfessionalProfile(user.professionalProfile)
      : null,
    reviewsReceived: user.reviewsReceived?.map((r: any) => ({
      id: r.id.toString(),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewer: {
        id: r.reviewer.id.toString(),
        fullName: r.reviewer.fullName,
        avatarUrl: r.reviewer.avatarUrl,
      },
    })),
  };
}

function serializePublicProfile(profile: any) {
  return {
    id: profile.id.toString(),
    fullName: profile.fullName,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    createdAt: profile.createdAt,
    roles: profile.userRoles?.map((ur: any) => ur.role.name) || profile.roles || [],
    professionalProfile: profile.professionalProfile
      ? serializeProfessionalProfile(profile.professionalProfile)
      : null,
    averageRating: profile.averageRating || 0,
    totalReviews: profile.totalReviews || profile._count?.reviewsReceived || 0,
    reviewsReceived: profile.reviewsReceived?.map((r: any) => ({
      id: r.id.toString(),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewer: {
        id: r.reviewer.id.toString(),
        fullName: r.reviewer.fullName,
        avatarUrl: r.reviewer.avatarUrl,
      },
    })),
  };
}

function serializeProfessionalProfile(profile: any) {
  if (!profile) return null;
  return {
    id: profile.id.toString(),
    userId: profile.userId.toString(),
    description: profile.description,
    yearsExperience: profile.yearsExperience,
    hourlyRate: profile.hourlyRate ? parseFloat(profile.hourlyRate.toString()) : null,
    portfolioUrl: profile.portfolioUrl,
    availability: profile.availability,
    verified: profile.verified,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    user: profile.user
      ? {
          id: profile.user.id.toString(),
          fullName: profile.user.fullName,
          email: profile.user.email,
          phone: profile.user.phone,
          city: profile.user.city,
          avatarUrl: profile.user.avatarUrl,
          bio: profile.user.bio,
        }
      : undefined,
  };
}

export default router;
