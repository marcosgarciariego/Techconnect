import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import * as userService from '../services/userService';
import * as adService from '../services/adService';
import * as auditService from '../services/auditService';
import { categorySchema } from '../utils/validation';

const router = Router();

// Apply admin middleware to all routes
router.use(authMiddleware, requireAdmin);

// ===== USER MANAGEMENT =====

// List all users
router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const isActive = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;

    const result = await userService.listAllUsers(page, pageSize, search, role, isActive);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeUser),
      },
    });
  })
);

// Toggle user active status
router.patch(
  '/users/:id/toggle-active',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.id);
    const { isActive } = req.body;
    const user = await userService.toggleUserActive(userId, isActive);
    await auditService.createAuditLog(
      req.user!.id,
      isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      'User',
      userId,
      `Usuario ${isActive ? 'activado' : 'desactivado'}: ${user.email}`
    );
    res.json({
      success: true,
      data: {
        id: user.id.toString(),
        isActive: user.isActive,
      },
    });
  })
);

// Add role to user
router.post(
  '/users/:id/roles',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.id);
    const { roleName } = req.body;
    await userService.addRoleToUser(userId, roleName);
    await auditService.createAuditLog(
      req.user!.id,
      'ADD_ROLE',
      'User',
      userId,
      `Rol añadido: ${roleName}`
    );
    res.json({
      success: true,
      message: 'Rol añadido correctamente',
    });
  })
);

// Remove role from user
router.delete(
  '/users/:id/roles/:roleName',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = BigInt(req.params.id);
    const { roleName } = req.params;
    await userService.removeRoleFromUser(userId, roleName);
    await auditService.createAuditLog(
      req.user!.id,
      'REMOVE_ROLE',
      'User',
      userId,
      `Rol eliminado: ${roleName}`
    );
    res.json({
      success: true,
      message: 'Rol eliminado correctamente',
    });
  })
);

// ===== AD MANAGEMENT =====

// List all ads
router.get(
  '/ads',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const categoryId = req.query.categoryId as string;

    const result = await adService.listAllAds(page, pageSize, search, status, categoryId);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeAd),
      },
    });
  })
);

// Update ad status
router.patch(
  '/ads/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    const { status } = req.body;
    const ad = await adService.updateAdStatus(adId, status, req.user!.id);
    res.json({
      success: true,
      data: {
        id: ad.id.toString(),
        status: ad.status,
      },
    });
  })
);

// Delete ad
router.delete(
  '/ads/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.id);
    await adService.deleteAd(adId, req.user!.id, true);
    res.json({
      success: true,
      message: 'Anuncio eliminado correctamente',
    });
  })
);

// ===== CATEGORY MANAGEMENT =====

// Create category
router.post(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = categorySchema.parse(req.body);
    const category = await adService.createCategory(name, description);
    await auditService.createAuditLog(
      req.user!.id,
      'CREATE',
      'Category',
      category.id,
      `Categoría creada: ${name}`
    );
    res.status(201).json({
      success: true,
      data: {
        id: category.id.toString(),
        name: category.name,
        description: category.description,
      },
    });
  })
);

// Update category
router.put(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = BigInt(req.params.id);
    const { name, description } = categorySchema.parse(req.body);
    const category = await adService.updateCategory(categoryId, name, description);
    await auditService.createAuditLog(
      req.user!.id,
      'UPDATE',
      'Category',
      categoryId,
      `Categoría actualizada: ${name}`
    );
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

// Delete category
router.delete(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = BigInt(req.params.id);
    await adService.deleteCategory(categoryId);
    await auditService.createAuditLog(
      req.user!.id,
      'DELETE',
      'Category',
      categoryId,
      'Categoría eliminada'
    );
    res.json({
      success: true,
      message: 'Categoría eliminada correctamente',
    });
  })
);

// ===== AUDIT LOG =====

// Get audit logs
router.get(
  '/audit-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const filters = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const result = await auditService.getAuditLogs(page, pageSize, filters);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeAuditLog),
      },
    });
  })
);

// Get recent audit logs
router.get(
  '/audit-logs/recent',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const logs = await auditService.getRecentAuditLogs(limit);
    res.json({
      success: true,
      data: logs.map(serializeAuditLog),
    });
  })
);

// ===== DASHBOARD STATS =====

router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [usersCount, adsCount, ordersCount, categoriesCount] = await Promise.all([
      (await import('../config/database')).default.user.count(),
      (await import('../config/database')).default.ad.count(),
      (await import('../config/database')).default.serviceOrder.count(),
      (await import('../config/database')).default.category.count(),
    ]);

    const activeAds = await (await import('../config/database')).default.ad.count({
      where: { status: 'active' },
    });

    const completedOrders = await (await import('../config/database')).default.serviceOrder.count({
      where: { status: 'completed' },
    });

    const recentUsers = await (await import('../config/database')).default.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    res.json({
      success: true,
      data: {
        totalUsers: usersCount,
        totalAds: adsCount,
        totalOrders: ordersCount,
        totalCategories: categoriesCount,
        activeAds,
        completedOrders,
        recentUsers,
      },
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
    isActive: user.isActive,
    createdAt: user.createdAt,
    roles: user.roles || [],
  };
}

function serializeAd(ad: any) {
  return {
    id: ad.id.toString(),
    title: ad.title,
    status: ad.status,
    createdAt: ad.createdAt,
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
          email: ad.user.email,
        }
      : null,
    applicationsCount: ad._count?.applications || 0,
  };
}

function serializeAuditLog(log: any) {
  return {
    id: log.id.toString(),
    userId: log.userId?.toString() || null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId?.toString() || null,
    details: log.details,
    createdAt: log.createdAt,
    user: log.user
      ? {
          id: log.user.id.toString(),
          fullName: log.user.fullName,
          email: log.user.email,
        }
      : null,
  };
}

export default router;
