import type { NextFunction, Request, Response } from 'express';

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autorizado' });
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: 'No tienes permisos para realizar esta acción',
      });
      return;
    }

    next();
  };
}

export function requireClient(req: Request, res: Response, next: NextFunction): void {
  return requireRoles('client', 'admin')(req, res, next);
}

export function requireProfessional(req: Request, res: Response, next: NextFunction): void {
  return requireRoles('professional', 'admin')(req, res, next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRoles('admin')(req, res, next);
}

export function isOwnerOrAdmin(resourceUserId: bigint, req: Request): boolean {
  if (!req.user) return false;
  return req.user.id === resourceUserId || req.user.roles.includes('admin');
}
