import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { requireProfessional } from '../middleware/roles';
import * as applicationService from '../services/applicationService';
import {
  createApplicationMultipartSchema,
  createApplicationSchema,
  updateApplicationStatusSchema,
} from '../utils/validation';

const router = Router();
const applicationUploadDir = path.join(process.cwd(), 'public', 'uploads', 'applications');

fs.mkdirSync(applicationUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, applicationUploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, safeName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ]);

    if (allowedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Tipo de archivo no permitido'));
  },
});

// Create application (professional only)
router.post(
  '/',
  authMiddleware,
  requireProfessional,
  upload.array('attachments', 5),
  asyncHandler(async (req: Request, res: Response) => {
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    try {
      const body = compactFormBody(req.body);
      const data = req.is('multipart/form-data')
        ? createApplicationMultipartSchema.parse(body)
        : createApplicationSchema.parse(req.body);
      const attachments = uploadedFiles.map((file) => ({
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/applications/${file.filename}`,
      }));
      const application = await applicationService.createApplication(req.user!.id, data, attachments);

      res.status(201).json({
        success: true,
        data: serializeApplication(application),
      });
    } catch (error) {
      cleanupUploadedFiles(uploadedFiles);
      throw error;
    }
  })
);

// Get applications for a specific ad
router.get(
  '/ad/:adId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const adId = BigInt(req.params.adId);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await applicationService.getApplicationsForAd(adId, req.user!.id, page, pageSize);
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeApplication),
      },
    });
  })
);

// Get professional's applications
router.get(
  '/professional/mine',
  authMiddleware,
  requireProfessional,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string;
    const result = await applicationService.getProfessionalApplications(
      req.user!.id,
      page,
      pageSize,
      status
    );
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeApplication),
      },
    });
  })
);

// Get received applications (for client's ads)
router.get(
  '/received/mine',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const status = req.query.status as string | undefined;
    const adId = req.query.adId as string | undefined;
    const result = await applicationService.getReceivedApplications(
      req.user!.id,
      page,
      pageSize,
      status,
      adId
    );
    res.json({
      success: true,
      data: {
        ...result,
        items: result.items.map(serializeApplication),
      },
    });
  })
);

// Get application by ID
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = BigInt(req.params.id);
    const application = await applicationService.getApplicationById(applicationId, req.user!.id);
    res.json({
      success: true,
      data: serializeApplication(application),
    });
  })
);

// Update application status
router.patch(
  '/:id/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const applicationId = BigInt(req.params.id);
    const { status } = updateApplicationStatusSchema.parse(req.body);
    const application = await applicationService.updateApplicationStatus(
      applicationId,
      req.user!.id,
      status
    );
    res.json({
      success: true,
      data: serializeApplication(application),
    });
  })
);

function serializeApplication(app: any) {
  return {
    id: app.id.toString(),
    adId: app.adId.toString(),
    professionalUserId: app.professionalUserId.toString(),
    coverLetter: app.coverLetter,
    proposedPrice: app.proposedPrice ? parseFloat(app.proposedPrice.toString()) : null,
    estimatedDays: app.estimatedDays,
    status: app.status,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    ad: app.ad
      ? {
          id: app.ad.id.toString(),
          title: app.ad.title,
          description: app.ad.description,
          budgetMin: app.ad.budgetMin ? parseFloat(app.ad.budgetMin.toString()) : null,
          budgetMax: app.ad.budgetMax ? parseFloat(app.ad.budgetMax.toString()) : null,
          modality: app.ad.modality,
          location: app.ad.location,
          status: app.ad.status,
          category: app.ad.category
            ? {
                id: app.ad.category.id.toString(),
                name: app.ad.category.name,
              }
            : null,
          user: app.ad.user
            ? {
                id: app.ad.user.id.toString(),
                fullName: app.ad.user.fullName,
                avatarUrl: app.ad.user.avatarUrl,
              }
            : null,
          images: app.ad.images?.map((img: any) => ({
            id: img.id.toString(),
            imageUrl: img.imageUrl,
            isMain: img.isMain,
          })),
        }
      : null,
    professional: app.professional
      ? {
          id: app.professional.id.toString(),
          fullName: app.professional.fullName,
          avatarUrl: app.professional.avatarUrl,
          city: app.professional.city,
          email: app.professional.email,
          phone: app.professional.phone,
          professionalProfile: app.professional.professionalProfile
            ? {
                id: app.professional.professionalProfile.id.toString(),
                description: app.professional.professionalProfile.description,
                yearsExperience: app.professional.professionalProfile.yearsExperience,
                hourlyRate: app.professional.professionalProfile.hourlyRate
                  ? parseFloat(app.professional.professionalProfile.hourlyRate.toString())
                  : null,
                availability: app.professional.professionalProfile.availability,
                verified: app.professional.professionalProfile.verified,
              }
            : null,
          averageRating: app.professional.averageRating || 0,
          totalReviews: app.professional.totalReviews || 0,
        }
      : null,
    serviceOrder: app.serviceOrder
      ? {
          id: app.serviceOrder.id.toString(),
          status: app.serviceOrder.status,
          agreedPrice: parseFloat(app.serviceOrder.agreedPrice.toString()),
        }
      : null,
    attachments: app.attachments?.map(serializeAttachment) || [],
  };
}

function serializeAttachment(attachment: any) {
  return {
    id: attachment.id.toString(),
    applicationId: attachment.applicationId.toString(),
    fileName: attachment.fileName,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    uploadedAt: attachment.uploadedAt,
  };
}

function compactFormBody(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.some((item) => item !== '');
      }

      return value !== '';
    })
  );
}

function cleanupUploadedFiles(files: Express.Multer.File[]) {
  for (const file of files) {
    fs.rm(file.path, { force: true }, () => undefined);
  }
}

export default router;
