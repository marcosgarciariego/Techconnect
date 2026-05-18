import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  email: z.string().email('Email invalido').max(150),
  password: z.string().min(6, 'La contrasena debe tener al menos 6 caracteres').max(100),
  phone: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  role: z.enum(['client', 'professional']).default('client'),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
});

// User schemas
export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
});

export const updateProfessionalProfileSchema = z.object({
  description: z.string().max(2000).optional().nullable(),
  yearsExperience: z.number().int().min(0).max(50).optional().nullable(),
  hourlyRate: z.number().min(0).max(10000).optional().nullable(),
  portfolioUrl: z.string().url().optional().nullable(),
  availability: z.enum(['full-time', 'part-time', 'freelance', 'unavailable']).optional().nullable(),
});

// Ad schemas
const adSchemaBase = z.object({
  categoryId: z.number().int().positive('La categoria es requerida'),
  title: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(150),
  description: z.string().min(20, 'La descripcion debe tener al menos 20 caracteres'),
  budgetMin: z.number().min(0).optional().nullable(),
  budgetMax: z.number().min(0).optional().nullable(),
  modality: z.enum(['online', 'presencial', 'hibrido']),
  location: z.string().max(150).optional().nullable(),
  status: z.enum(['draft', 'active', 'closed', 'cancelled']).default('active'),
});

const hasValidBudgetRange = (data: { budgetMin?: number | null; budgetMax?: number | null }) => {
  if (data.budgetMin != null && data.budgetMax != null) {
    return data.budgetMax >= data.budgetMin;
  }

  return true;
};

export const createAdSchema = adSchemaBase.refine(hasValidBudgetRange, {
  message: 'El presupuesto maximo debe ser mayor o igual al minimo',
});

export const updateAdSchema = adSchemaBase.partial().refine(hasValidBudgetRange, {
  message: 'El presupuesto maximo debe ser mayor o igual al minimo',
});

// Application schemas
export const createApplicationSchema = z.object({
  adId: z.number().int().positive('El anuncio es requerido'),
  coverLetter: z.string().max(2000).optional(),
  proposedPrice: z.number().min(0).optional().nullable(),
  estimatedDays: z.number().int().min(1).max(365).optional().nullable(),
});

export const createApplicationMultipartSchema = z.object({
  adId: z.coerce.number().int().positive('El anuncio es requerido'),
  coverLetter: z.string().max(2000).optional(),
  proposedPrice: z.coerce.number().min(0).optional(),
  estimatedDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'cancelled']),
});

// Service Order schemas
export const createServiceOrderSchema = z.object({
  applicationId: z.number().int().positive('La candidatura es requerida'),
  agreedPrice: z.number().min(0, 'El precio acordado es requerido'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled']),
});

// Review schemas
export const createReviewSchema = z.object({
  orderId: z.number().int().positive('La orden es requerida'),
  reviewedUserId: z.number().int().positive('El usuario a valorar es requerido'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Message schemas
export const sendMessageSchema = z.object({
  conversationId: z.number().int().positive('La conversacion es requerida'),
  body: z.string().min(1, 'El mensaje no puede estar vacio').max(5000),
});

export const createConversationSchema = z.object({
  participantIds: z.array(z.number().int().positive()).min(1),
  adId: z.number().int().positive().optional(),
  applicationId: z.number().int().positive().optional(),
  orderId: z.number().int().positive().optional(),
});

// Category schema (admin)
export const categorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(255).optional(),
});

// Filter schemas
export const adFiltersSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  modality: z.enum(['online', 'presencial', 'hibrido']).optional(),
  location: z.string().optional(),
  status: z.enum(['draft', 'active', 'closed', 'cancelled']).optional(),
  budgetMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['newest', 'oldest', 'budget_asc', 'budget_desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProfessionalProfileInput = z.infer<typeof updateProfessionalProfileSchema>;
export type CreateAdInput = z.infer<typeof createAdSchema>;
export type UpdateAdInput = z.infer<typeof updateAdSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type CreateApplicationMultipartInput = z.infer<typeof createApplicationMultipartSchema>;
export type CreateServiceOrderInput = z.infer<typeof createServiceOrderSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AdFiltersInput = z.infer<typeof adFiltersSchema>;
