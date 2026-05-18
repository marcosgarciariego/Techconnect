import prisma from '../config/database';
import type { UpdateProfessionalProfileInput, UpdateProfileInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { AuthUser, PaginatedResponse } from '../types';

export async function getUserById(id: bigint) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      professionalProfile: true,
      reviewsReceived: {
        include: {
          reviewer: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          order: {
            include: {
              application: {
                include: {
                  ad: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return user;
}

export async function getPublicProfile(id: bigint) {
  const user = await prisma.user.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      fullName: true,
      city: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      userRoles: {
        include: {
          role: true,
        },
      },
      professionalProfile: true,
      reviewsReceived: {
        include: {
          reviewer: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
      _count: {
        select: {
          reviewsReceived: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  // Calculate average rating
  const ratings = await prisma.review.aggregate({
    where: { reviewedUserId: id },
    _avg: { rating: true },
    _count: true,
  });

  return {
    ...user,
    averageRating: ratings._avg.rating || 0,
    totalReviews: ratings._count,
    roles: user.userRoles.map((ur) => ur.role.name),
  };
}

export async function updateProfile(userId: bigint, data: UpdateProfileInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      city: data.city,
      avatarUrl: data.avatarUrl,
      bio: data.bio,
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      professionalProfile: true,
    },
  });

  return {
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
}

export async function getProfessionalProfile(userId: bigint) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          city: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError('Perfil profesional no encontrado', 404);
  }

  return profile;
}

export async function updateProfessionalProfile(
  userId: bigint,
  data: UpdateProfessionalProfileInput
) {
  // Check if user has professional role
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        name: 'professional',
      },
    },
  });

  if (!userRole) {
    throw new AppError('No tienes permisos de profesional', 403);
  }

  const profile = await prisma.professionalProfile.upsert({
    where: { userId },
    update: {
      description: data.description,
      yearsExperience: data.yearsExperience,
      hourlyRate: data.hourlyRate,
      portfolioUrl: data.portfolioUrl,
      availability: data.availability,
    },
    create: {
      userId,
      description: data.description,
      yearsExperience: data.yearsExperience,
      hourlyRate: data.hourlyRate,
      portfolioUrl: data.portfolioUrl,
      availability: data.availability,
    },
  });

  return profile;
}

export async function listProfessionals(
  page: number = 1,
  pageSize: number = 12,
  search?: string,
  availability?: string
): Promise<PaginatedResponse<any>> {
  const where: any = {
    professionalProfile: {
      isNot: null,
    },
    isActive: true,
    userRoles: {
      some: {
        role: {
          name: 'professional',
        },
      },
    },
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { city: { contains: search } },
      { professionalProfile: { description: { contains: search } } },
    ];
  }

  if (availability) {
    where.professionalProfile = {
      ...where.professionalProfile,
      availability,
    };
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        professionalProfile: true,
        _count: {
          select: {
            reviewsReceived: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Get average ratings for each professional
  const professionalsWithRatings = await Promise.all(
    items.map(async (user) => {
      const ratings = await prisma.review.aggregate({
        where: { reviewedUserId: user.id },
        _avg: { rating: true },
      });

      return {
        id: user.id,
        fullName: user.fullName,
        city: user.city,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        professionalProfile: user.professionalProfile,
        averageRating: ratings._avg.rating || 0,
        totalReviews: user._count.reviewsReceived,
      };
    })
  );

  return {
    items: professionalsWithRatings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Admin functions
export async function listAllUsers(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  role?: string,
  isActive?: boolean
): Promise<PaginatedResponse<any>> {
  const where: any = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email: { contains: search } },
    ];
  }

  if (role) {
    where.userRoles = {
      some: {
        role: {
          name: role,
        },
      },
    };
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      city: user.city,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ur.role.name),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function toggleUserActive(userId: bigint, isActive: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });
}

export async function addRoleToUser(userId: bigint, roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new AppError('Rol no encontrado', 404);
  }

  return prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
    },
  });
}

export async function removeRoleFromUser(userId: bigint, roleName: string) {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new AppError('Rol no encontrado', 404);
  }

  return prisma.userRole.delete({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
  });
}
