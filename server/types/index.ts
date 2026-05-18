import type { ProfessionalProfile } from '@prisma/client';

export interface JwtPayload {
  userId: bigint;
  email: string;
}

export interface AuthUser {
  id: bigint;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  roles: string[];
  professionalProfile?: ProfessionalProfile | null;
}

export interface TokenResponse {
  user: AuthUser;
  token: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdFilters {
  search?: string;
  categoryId?: string;
  modality?: string;
  location?: string;
  status?: string;
  budgetMin?: number;
  budgetMax?: number;
  sortBy?: 'newest' | 'oldest' | 'budget_asc' | 'budget_desc';
  page?: number;
  pageSize?: number;
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type AdStatus = 'draft' | 'active' | 'closed' | 'cancelled';
export type OrderStatus = 'active' | 'completed' | 'cancelled';
export type Modality = 'online' | 'presencial' | 'hibrido';

export interface CreateAdDto {
  categoryId: number;
  title: string;
  description: string;
  budgetMin?: number;
  budgetMax?: number;
  modality: Modality;
  location?: string;
  status?: AdStatus;
}

export interface CreateApplicationDto {
  adId: number;
  coverLetter?: string;
  proposedPrice?: number;
  estimatedDays?: number;
}

export interface CreateReviewDto {
  orderId: number;
  reviewedUserId: number;
  rating: number;
  comment?: string;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  city?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface UpdateProfessionalProfileDto {
  description?: string;
  yearsExperience?: number;
  hourlyRate?: number;
  portfolioUrl?: string;
  availability?: string;
}

export interface ChatMessage {
  conversationId: number;
  senderId: number;
  body: string;
}

export interface SocketUser {
  userId: number;
  socketId: string;
}
