import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import prisma from '../config/database';
import type { JwtPayload } from '../types';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'No autorizado' });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        professionalProfile: true,
      },
    });

    if (!user || !user.isActive || user.email !== decoded.email) {
      res.clearCookie('token');
      res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo' });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      city: user.city,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isActive: user.isActive,
      roles: user.userRoles.map((ur) => ur.role.name),
      professionalProfile: user.professionalProfile,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.clearCookie('token');
      res.status(401).json({ success: false, error: 'Token expirado' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.clearCookie('token');
      res.status(401).json({ success: false, error: 'Token inválido' });
      return;
    }
    res.status(500).json({ success: false, error: 'Error de autenticación' });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token || req.headers.authorization?.substring(7);

  if (!token) {
    next();
    return;
  }

  authMiddleware(req, res, next);
}

export function generateToken(userId: bigint, email: string): string {
  return jwt.sign(
    { userId: userId.toString(), email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
