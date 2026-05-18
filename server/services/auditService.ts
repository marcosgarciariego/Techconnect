import prisma from '../config/database';
import type { PaginatedResponse } from '../types';

export async function createAuditLog(
  userId: bigint | null,
  action: string,
  entityType: string,
  entityId: bigint | null,
  details?: string
) {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details,
    },
  });
}

export async function getAuditLogs(
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<PaginatedResponse<any>> {
  const where: any = {};

  if (filters?.userId) {
    where.userId = BigInt(filters.userId);
  }

  if (filters?.action) {
    where.action = { contains: filters.action };
  }

  if (filters?.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters?.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getRecentAuditLogs(limit: number = 10) {
  return prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}
