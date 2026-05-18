import prisma from '../config/database';
import type { CreateApplicationInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';
import type { PaginatedResponse } from '../types';
import { createAuditLog } from './auditService';
import { createNotification } from './notificationService';

export interface ApplicationAttachmentInput {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export async function createApplication(
  userId: bigint,
  data: CreateApplicationInput,
  attachments: ApplicationAttachmentInput[] = []
) {
  const ad = await prisma.ad.findUnique({
    where: { id: BigInt(data.adId) },
    include: {
      user: true,
    },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  if (ad.status !== 'active') {
    throw new AppError('El anuncio no está activo', 400);
  }

  if (ad.userId === userId) {
    throw new AppError('No puedes aplicar a tu propio anuncio', 400);
  }

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
    throw new AppError('Necesitas ser profesional para enviar candidaturas', 403);
  }

  // Check if already applied
  const existingApplication = await prisma.application.findFirst({
    where: {
      adId: BigInt(data.adId),
      professionalUserId: userId,
    },
  });

  if (existingApplication) {
    throw new AppError('Ya has enviado una candidatura a este anuncio', 409);
  }

  const application = await prisma.application.create({
    data: {
      adId: BigInt(data.adId),
      professionalUserId: userId,
      coverLetter: data.coverLetter,
      proposedPrice: data.proposedPrice,
      estimatedDays: data.estimatedDays,
      status: 'pending',
      attachments: attachments.length
        ? {
            create: attachments,
          }
        : undefined,
    },
    include: {
      attachments: true,
      ad: {
        include: {
          category: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          city: true,
          professionalProfile: true,
        },
      },
    },
  });

  // Create notification for ad owner
  await createNotification(
    ad.userId,
    'Nueva candidatura recibida',
    `${application.professional.fullName} ha enviado una candidatura para "${ad.title}"`,
    'application_new'
  );

  await createAuditLog(userId, 'CREATE', 'Application', application.id, `Candidatura enviada al anuncio: ${ad.title}`);

  return application;
}

export async function getApplicationById(applicationId: bigint, userId: bigint) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      ad: {
        include: {
          category: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              city: true,
            },
          },
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          city: true,
          email: true,
          phone: true,
          professionalProfile: true,
        },
      },
      attachments: true,
      serviceOrder: true,
    },
  });

  if (!application) {
    throw new AppError('Candidatura no encontrada', 404);
  }

  // Check if user can view this application
  const isAdOwner = application.ad.userId === userId;
  const isProfessional = application.professionalUserId === userId;
  const isAdmin = await checkIsAdmin(userId);

  if (!isAdOwner && !isProfessional && !isAdmin) {
    throw new AppError('No tienes permisos para ver esta candidatura', 403);
  }

  return application;
}

export async function updateApplicationStatus(
  applicationId: bigint,
  userId: bigint,
  status: string
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      ad: true,
      professional: true,
    },
  });

  if (!application) {
    throw new AppError('Candidatura no encontrada', 404);
  }

  // Check permissions
  const isAdOwner = application.ad.userId === userId;
  const isProfessional = application.professionalUserId === userId;

  // Only ad owner can accept/reject
  if ((status === 'accepted' || status === 'rejected') && !isAdOwner) {
    throw new AppError('Solo el dueño del anuncio puede aceptar o rechazar candidaturas', 403);
  }

  // Only professional can cancel their own application
  if (status === 'cancelled' && !isProfessional) {
    throw new AppError('Solo puedes cancelar tu propia candidatura', 403);
  }

  const updatedApplication = await prisma.application.update({
    where: { id: applicationId },
    data: { status },
    include: {
      ad: {
        include: {
          category: true,
        },
      },
      professional: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      attachments: true,
    },
  });

  // Create notification
  if (status === 'accepted') {
    await createNotification(
      application.professionalUserId,
      'Candidatura aceptada',
      `Tu candidatura para "${application.ad.title}" ha sido aceptada`,
      'application_accepted'
    );
  } else if (status === 'rejected') {
    await createNotification(
      application.professionalUserId,
      'Candidatura rechazada',
      `Tu candidatura para "${application.ad.title}" ha sido rechazada`,
      'application_rejected'
    );
  }

  await createAuditLog(
    userId,
    'UPDATE_STATUS',
    'Application',
    applicationId,
    `Estado cambiado a: ${status}`
  );

  return updatedApplication;
}

export async function getApplicationsForAd(adId: bigint, userId: bigint, page: number = 1, pageSize: number = 10) {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
  });

  if (!ad) {
    throw new AppError('Anuncio no encontrado', 404);
  }

  if (ad.userId !== userId) {
    throw new AppError('No tienes permisos para ver las candidaturas', 403);
  }

  const where = { adId };

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        professional: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            city: true,
            professionalProfile: true,
          },
        },
        attachments: true,
        serviceOrder: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  // Get ratings for each professional
  const itemsWithRatings = await Promise.all(
    items.map(async (app) => {
      const ratings = await prisma.review.aggregate({
        where: { reviewedUserId: app.professionalUserId },
        _avg: { rating: true },
        _count: true,
      });

      return {
        ...app,
        professional: {
          ...app.professional,
          averageRating: ratings._avg.rating || 0,
          totalReviews: ratings._count,
        },
      };
    })
  );

  return {
    items: itemsWithRatings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProfessionalApplications(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10,
  status?: string
): Promise<PaginatedResponse<any>> {
  const where: any = { professionalUserId: userId };

  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        ad: {
          include: {
            category: true,
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            images: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
        serviceOrder: true,
        attachments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getReceivedApplications(
  userId: bigint,
  page: number = 1,
  pageSize: number = 10,
  status?: string,
  adId?: string
): Promise<PaginatedResponse<any>> {
  // Get all ads of the user first
  const userAds = await prisma.ad.findMany({
    where: { userId },
    select: { id: true },
  });

  const adIds = userAds.map((ad) => ad.id);

  const where: any = {
    adId: { in: adIds },
  };

  if (status) {
    where.status = status;
  }

  if (adId) {
    const filteredAdId = BigInt(adId);
    if (adIds.some((id) => id === filteredAdId)) {
      where.adId = filteredAdId;
    } else {
      where.adId = { in: [] };
    }
  }

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        ad: {
          include: {
            category: true,
            images: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
        professional: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            city: true,
            professionalProfile: true,
          },
        },
        serviceOrder: true,
        attachments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  // Get ratings for each professional
  const itemsWithRatings = await Promise.all(
    items.map(async (app) => {
      const ratings = await prisma.review.aggregate({
        where: { reviewedUserId: app.professionalUserId },
        _avg: { rating: true },
        _count: true,
      });

      return {
        ...app,
        professional: {
          ...app.professional,
          averageRating: ratings._avg.rating || 0,
          totalReviews: ratings._count,
        },
      };
    })
  );

  return {
    items: itemsWithRatings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async function checkIsAdmin(userId: bigint): Promise<boolean> {
  const adminRole = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        name: 'admin',
      },
    },
  });

  return !!adminRole;
}
