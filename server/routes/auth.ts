import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, verifyToken } from '../middleware/auth';
import * as authService from '../services/authService';
import { registerSchema, loginSchema } from '../utils/validation';

const router = Router();

// Register
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);

    // Set httpOnly cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: serializeUser(result.user),
        token: result.token,
      },
    });
  })
);

// Login
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);

    // Set httpOnly cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        user: serializeUser(result.user),
        token: result.token,
      },
    });
  })
);

// Logout
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  })
);

// Get current user
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: serializeUser(req.user!),
    });
  })
);

// Validate token
router.get(
  '/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!token) {
      res.json({
        success: true,
        data: {
          valid: false,
          user: null,
        },
      });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.clearCookie('token');
      res.json({
        success: true,
        data: {
          valid: false,
          user: null,
        },
      });
      return;
    }

    const user = await authService.validateToken(BigInt(decoded.userId), decoded.email);
    if (!user) {
      res.clearCookie('token');
      res.json({
        success: true,
        data: {
          valid: false,
          user: null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user: serializeUser(user),
      },
    });
  })
);

// Helper to serialize BigInt to string
function serializeUser(user: any) {
  return {
    ...user,
    id: user.id.toString(),
    professionalProfile: user.professionalProfile
      ? {
          ...user.professionalProfile,
          id: user.professionalProfile.id?.toString(),
          userId: user.professionalProfile.userId?.toString(),
          hourlyRate: user.professionalProfile.hourlyRate?.toString(),
        }
      : null,
  };
}

export default router;
