import type { APIRoute } from 'astro';
import { Prisma, type Ad, type AdImage, type Category, type User } from '@prisma/client';
import { parse as parseCookie } from 'cookie';
import { ZodError } from 'zod';

import * as adService from '../../../server/services/adService';
import type { ApplicationAttachmentInput } from '../../../server/services/applicationService';
import * as applicationService from '../../../server/services/applicationService';
import * as authService from '../../../server/services/authService';
import * as conversationService from '../../../server/services/conversationService';
import * as favoriteService from '../../../server/services/favoriteService';
import * as notificationService from '../../../server/services/notificationService';
import * as orderService from '../../../server/services/orderService';
import * as reviewService from '../../../server/services/reviewService';
import * as userService from '../../../server/services/userService';
import { AppError } from '../../../server/middleware/errorHandler';
import { verifyToken } from '../../../server/middleware/auth';
import {
  adFiltersSchema,
  createAdSchema,
  createApplicationMultipartSchema,
  createApplicationSchema,
  createConversationSchema,
  createReviewSchema,
  createServiceOrderSchema,
  loginSchema,
  registerSchema,
  sendMessageSchema,
  updateAdSchema,
  updateApplicationStatusSchema,
  updateOrderStatusSchema,
  updateProfessionalProfileSchema,
  updateProfileSchema,
} from '../../../server/utils/validation';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    if (pathname === '/health') {
      return json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      });
    }

    if (pathname === '/auth/me') {
      const user = await getAuthenticatedUser(request);

      if (!user) {
        return json({ success: false, error: 'No autorizado' }, 401);
      }

      return json({
        success: true,
        data: serializeUser(user),
      });
    }

    if (pathname === '/auth/validate') {
      const token = getRequestToken(request);

      if (!token) {
        return json({
          success: true,
          data: {
            valid: false,
            user: null,
          },
        });
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return json({
          success: true,
          data: {
            valid: false,
            user: null,
          },
        }, 200, { 'Set-Cookie': clearAuthCookie() });
      }

      const user = await authService.validateToken(BigInt(decoded.userId), decoded.email);

      if (!user) {
        return json({
          success: true,
          data: {
            valid: false,
            user: null,
          },
        }, 200, { 'Set-Cookie': clearAuthCookie() });
      }

      return json({
        success: true,
        data: {
          valid: true,
          user: serializeUser(user),
        },
      });
    }

    if (pathname === '/users/profile') {
      const user = await requireAuthenticatedUser(request);
      const profile = await userService.getUserById(user.id);

      return json({
        success: true,
        data: serializeUser(profile),
      });
    }

    if (pathname === '/users/professional/me') {
      const user = await requireAuthenticatedUser(request);
      requireRole(user, 'professional', 'admin');
      const profile = await userService.getProfessionalProfile(user.id);

      return json({
        success: true,
        data: serializeProfessionalProfile(profile),
      });
    }

    if (pathname === '/users/professionals/list') {
      const result = await userService.listProfessionals(
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 12),
        url.searchParams.get('search') || undefined,
        url.searchParams.get('availability') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializePublicProfile),
        },
      });
    }

    const publicUserMatch = pathname.match(/^\/users\/([^/]+)$/);
    if (publicUserMatch) {
      const profile = await userService.getPublicProfile(BigInt(publicUserMatch[1]));

      return json({
        success: true,
        data: serializePublicProfile(profile),
      });
    }

    if (pathname === '/ads') {
      const filters = adFiltersSchema.parse(Object.fromEntries(url.searchParams));
      const result = await adService.listAds(filters);

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeAd),
        },
      });
    }

    if (pathname === '/ads/user/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await adService.getUserAds(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 12),
        url.searchParams.get('status') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeAd),
        },
      });
    }

    const adMatch = pathname.match(/^\/ads\/([^/]+)$/);
    if (adMatch) {
      const ad = await adService.getAdById(BigInt(adMatch[1]));

      return json({
        success: true,
        data: serializeAd(ad),
      });
    }

    if (pathname === '/categories') {
      const categories = await adService.getCategories();

      return json({
        success: true,
        data: categories.map(serializeCategory),
      });
    }

    const categoryMatch = pathname.match(/^\/categories\/([^/]+)$/);
    if (categoryMatch) {
      const category = await adService.getCategoryById(BigInt(categoryMatch[1]));

      return json({
        success: true,
        data: serializeCategory(category),
      });
    }

    if (pathname === '/favorites') {
      const user = await requireAuthenticatedUser(request);
      const result = await favoriteService.getUserFavorites(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 12)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeAd),
        },
      });
    }

    const favoriteCheckMatch = pathname.match(/^\/favorites\/([^/]+)\/check$/);
    if (favoriteCheckMatch) {
      const user = await requireAuthenticatedUser(request);
      const isFavorited = await favoriteService.checkIsFavorite(user.id, BigInt(favoriteCheckMatch[1]));

      return json({
        success: true,
        data: { isFavorited },
      });
    }

    if (pathname === '/notifications/unread/count') {
      const user = await requireAuthenticatedUser(request);
      const count = await notificationService.getUnreadNotificationCount(user.id);

      return json({
        success: true,
        data: { count },
      });
    }

    if (pathname === '/notifications') {
      const user = await requireAuthenticatedUser(request);
      const result = await notificationService.getUserNotifications(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 20),
        url.searchParams.get('unreadOnly') === 'true'
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeNotification),
        },
      });
    }

    if (pathname === '/conversations/unread/count') {
      const user = await requireAuthenticatedUser(request);
      const count = await conversationService.getUnreadCount(user.id);

      return json({
        success: true,
        data: { count },
      });
    }

    if (pathname === '/conversations') {
      const user = await requireAuthenticatedUser(request);
      const result = await conversationService.getUserConversations(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 20)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeConversation),
        },
      });
    }

    const applicationConversationMatch = pathname.match(/^\/conversations\/application\/([^/]+)$/);
    if (applicationConversationMatch) {
      const user = await requireAuthenticatedUser(request);
      const conversation = await conversationService.getOrCreateConversationForApplication(
        BigInt(applicationConversationMatch[1]),
        user.id
      );

      return json({
        success: true,
        data: serializeConversation(conversation),
      });
    }

    const conversationMatch = pathname.match(/^\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const user = await requireAuthenticatedUser(request);
      const conversation = await conversationService.getConversationById(
        BigInt(conversationMatch[1]),
        user.id
      );

      return json({
        success: true,
        data: serializeConversation(conversation),
      });
    }

    if (pathname === '/applications/professional/mine') {
      const user = await requireAuthenticatedUser(request);
      requireRole(user, 'professional', 'admin');
      const result = await applicationService.getProfessionalApplications(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10),
        url.searchParams.get('status') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeApplication),
        },
      });
    }

    if (pathname === '/applications/received/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await applicationService.getReceivedApplications(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10),
        url.searchParams.get('status') || undefined,
        url.searchParams.get('adId') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeApplication),
        },
      });
    }

    const applicationsForAdMatch = pathname.match(/^\/applications\/ad\/([^/]+)$/);
    if (applicationsForAdMatch) {
      const user = await requireAuthenticatedUser(request);
      const result = await applicationService.getApplicationsForAd(
        BigInt(applicationsForAdMatch[1]),
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeApplication),
        },
      });
    }

    const applicationMatch = pathname.match(/^\/applications\/([^/]+)$/);
    if (applicationMatch) {
      const user = await requireAuthenticatedUser(request);
      const application = await applicationService.getApplicationById(BigInt(applicationMatch[1]), user.id);

      return json({
        success: true,
        data: serializeApplication(application),
      });
    }

    if (pathname === '/orders/client/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await orderService.getClientOrders(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10),
        url.searchParams.get('status') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeOrder),
        },
      });
    }

    if (pathname === '/orders/professional/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await orderService.getProfessionalOrders(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10),
        url.searchParams.get('status') || undefined
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeOrder),
        },
      });
    }

    const orderMatch = pathname.match(/^\/orders\/([^/]+)$/);
    if (orderMatch) {
      const user = await requireAuthenticatedUser(request);
      const order = await orderService.getOrderById(BigInt(orderMatch[1]), user.id);

      return json({
        success: true,
        data: serializeOrder(order),
      });
    }

    if (pathname === '/reviews/given/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await reviewService.getReviewsGivenByUser(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeReview),
        },
      });
    }

    if (pathname === '/reviews/received/mine') {
      const user = await requireAuthenticatedUser(request);
      const result = await reviewService.getUserReviews(
        user.id,
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeReview),
        },
      });
    }

    const reviewStatsMatch = pathname.match(/^\/reviews\/user\/([^/]+)\/stats$/);
    if (reviewStatsMatch) {
      const stats = await reviewService.getUserRatingStats(BigInt(reviewStatsMatch[1]));

      return json({
        success: true,
        data: stats,
      });
    }

    const userReviewsMatch = pathname.match(/^\/reviews\/user\/([^/]+)$/);
    if (userReviewsMatch) {
      const result = await reviewService.getUserReviews(
        BigInt(userReviewsMatch[1]),
        getQueryNumber(url, 'page', 1),
        getQueryNumber(url, 'pageSize', 10)
      );

      return json({
        success: true,
        data: {
          ...result,
          items: result.items.map(serializeReview),
        },
      });
    }

    const reviewMatch = pathname.match(/^\/reviews\/([^/]+)$/);
    if (reviewMatch) {
      const review = await reviewService.getReviewById(BigInt(reviewMatch[1]));

      return json({
        success: true,
        data: serializeReview(review),
      });
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    if (pathname === '/auth/register') {
      const data = registerSchema.parse(await readJsonBody(request));
      const result = await authService.register(data);

      return json({
        success: true,
        data: {
          user: serializeUser(result.user),
          token: result.token,
        },
      }, 201, { 'Set-Cookie': createAuthCookie(result.token) });
    }

    if (pathname === '/auth/login') {
      const data = loginSchema.parse(await readJsonBody(request));
      const result = await authService.login(data);

      return json({
        success: true,
        data: {
          user: serializeUser(result.user),
          token: result.token,
        },
      }, 200, { 'Set-Cookie': createAuthCookie(result.token) });
    }

    if (pathname === '/auth/logout') {
      return json({
        success: true,
        message: 'Sesion cerrada correctamente',
      }, 200, { 'Set-Cookie': clearAuthCookie() });
    }

    if (pathname === '/ads') {
      const user = await requireAuthenticatedUser(request);
      requireRole(user, 'client', 'admin');
      const data = createAdSchema.parse(await readJsonBody(request));
      const ad = await adService.createAd(user.id, data);

      return json({
        success: true,
        data: serializeAd(ad),
      }, 201);
    }

    const adImageMatch = pathname.match(/^\/ads\/([^/]+)\/images$/);
    if (adImageMatch) {
      const user = await requireAuthenticatedUser(request);
      const body = await readJsonBody(request);
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';

      if (!imageUrl) {
        throw new AppError('La URL de la imagen es requerida', 400);
      }

      const image = await adService.addAdImage(
        BigInt(adImageMatch[1]),
        user.id,
        imageUrl,
        body.isMain !== false
      );

      return json({
        success: true,
        data: serializeAdImage(image),
      }, 201);
    }

    if (pathname === '/applications') {
      const user = await requireAuthenticatedUser(request);
      requireRole(user, 'professional', 'admin');
      const { data, attachments } = await readApplicationBody(request);
      const application = await applicationService.createApplication(user.id, data, attachments);

      return json({
        success: true,
        data: serializeApplication(application),
      }, 201);
    }

    if (pathname === '/orders') {
      const user = await requireAuthenticatedUser(request);
      const data = createServiceOrderSchema.parse(await readJsonBody(request));
      const order = await orderService.createServiceOrder(user.id, data);

      return json({
        success: true,
        data: serializeOrder(order),
      }, 201);
    }

    if (pathname === '/conversations') {
      const user = await requireAuthenticatedUser(request);
      const data = createConversationSchema.parse(await readJsonBody(request));
      const conversation = await conversationService.createConversation(user.id, data);

      return json({
        success: true,
        data: serializeConversation(conversation),
      }, 201);
    }

    const markConversationReadMatch = pathname.match(/^\/conversations\/([^/]+)\/read$/);
    if (markConversationReadMatch) {
      const user = await requireAuthenticatedUser(request);
      await conversationService.markMessagesAsRead(BigInt(markConversationReadMatch[1]), user.id);

      return json({
        success: true,
        message: 'Messages marked as read',
      });
    }

    const sendMessageMatch = pathname.match(/^\/conversations\/([^/]+)\/messages$/);
    if (sendMessageMatch) {
      const user = await requireAuthenticatedUser(request);
      const body = await readJsonBody(request);
      const { body: messageBody } = sendMessageSchema.parse({
        conversationId: Number(sendMessageMatch[1]),
        body: body.body,
      });
      const message = await conversationService.sendMessage(user.id, {
        conversationId: Number(sendMessageMatch[1]),
        body: messageBody,
      });

      return json({
        success: true,
        data: serializeMessage(message),
      }, 201);
    }

    if (pathname === '/notifications/read-all') {
      const user = await requireAuthenticatedUser(request);
      await notificationService.markAllNotificationsAsRead(user.id);

      return json({
        success: true,
        message: 'Todas las notificaciones han sido marcadas como leidas',
      });
    }

    const favoriteToggleMatch = pathname.match(/^\/favorites\/([^/]+)\/toggle$/);
    if (favoriteToggleMatch) {
      const user = await requireAuthenticatedUser(request);
      const result = await favoriteService.toggleFavorite(user.id, BigInt(favoriteToggleMatch[1]));

      return json({
        success: true,
        data: result,
      });
    }

    const addFavoriteMatch = pathname.match(/^\/favorites\/([^/]+)$/);
    if (addFavoriteMatch) {
      const user = await requireAuthenticatedUser(request);
      await favoriteService.addFavorite(user.id, BigInt(addFavoriteMatch[1]));

      return json({
        success: true,
        message: 'Anuncio anadido a favoritos',
      }, 201);
    }

    if (pathname === '/reviews') {
      const user = await requireAuthenticatedUser(request);
      const data = createReviewSchema.parse(await readJsonBody(request));
      const review = await reviewService.createReview(user.id, data);

      return json({
        success: true,
        data: serializeReview(review),
      }, 201);
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    if (pathname === '/users/profile') {
      const user = await requireAuthenticatedUser(request);
      const data = updateProfileSchema.parse(await readJsonBody(request));
      const profile = await userService.updateProfile(user.id, data);

      return json({
        success: true,
        data: serializeUser(profile),
      });
    }

    if (pathname === '/users/professional/me') {
      const user = await requireAuthenticatedUser(request);
      requireRole(user, 'professional', 'admin');
      const data = updateProfessionalProfileSchema.parse(await readJsonBody(request));
      const profile = await userService.updateProfessionalProfile(user.id, data);

      return json({
        success: true,
        data: serializeProfessionalProfile(profile),
      });
    }

    const adMatch = pathname.match(/^\/ads\/([^/]+)$/);
    if (adMatch) {
      const user = await requireAuthenticatedUser(request);
      const data = updateAdSchema.parse(await readJsonBody(request));
      const ad = await adService.updateAd(adMatch[1] ? BigInt(adMatch[1]) : 0n, user.id, data, user.roles.includes('admin'));

      return json({
        success: true,
        data: serializeAd(ad),
      });
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    const applicationStatusMatch = pathname.match(/^\/applications\/([^/]+)\/status$/);
    if (applicationStatusMatch) {
      const user = await requireAuthenticatedUser(request);
      const { status } = updateApplicationStatusSchema.parse(await readJsonBody(request));
      const application = await applicationService.updateApplicationStatus(
        BigInt(applicationStatusMatch[1]),
        user.id,
        status
      );

      return json({
        success: true,
        data: serializeApplication(application),
      });
    }

    const orderStatusMatch = pathname.match(/^\/orders\/([^/]+)\/status$/);
    if (orderStatusMatch) {
      const user = await requireAuthenticatedUser(request);
      const { status } = updateOrderStatusSchema.parse(await readJsonBody(request));
      const order = await orderService.updateOrderStatus(BigInt(orderStatusMatch[1]), user.id, status);

      return json({
        success: true,
        data: serializeOrder(order),
      });
    }

    const notificationReadMatch = pathname.match(/^\/notifications\/([^/]+)\/read$/);
    if (notificationReadMatch) {
      const user = await requireAuthenticatedUser(request);
      const notification = await notificationService.markNotificationAsRead(
        BigInt(notificationReadMatch[1]),
        user.id
      );

      if (!notification) {
        return json({ success: false, error: 'Notificacion no encontrada' }, 404);
      }

      return json({
        success: true,
        data: serializeNotification(notification),
      });
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pathname = normalizeApiPath(url.pathname);

    const favoriteMatch = pathname.match(/^\/favorites\/([^/]+)$/);
    if (favoriteMatch) {
      const user = await requireAuthenticatedUser(request);
      await favoriteService.removeFavorite(user.id, BigInt(favoriteMatch[1]));

      return json({
        success: true,
        message: 'Anuncio eliminado de favoritos',
      });
    }

    const notificationMatch = pathname.match(/^\/notifications\/([^/]+)$/);
    if (notificationMatch) {
      const user = await requireAuthenticatedUser(request);
      const result = await notificationService.deleteNotification(BigInt(notificationMatch[1]), user.id);

      if (!result) {
        return json({ success: false, error: 'Notificacion no encontrada' }, 404);
      }

      return json({
        success: true,
        message: 'Notificacion eliminada',
      });
    }

    const adMatch = pathname.match(/^\/ads\/([^/]+)$/);
    if (adMatch) {
      const user = await requireAuthenticatedUser(request);
      await adService.deleteAd(BigInt(adMatch[1]), user.id, user.roles.includes('admin'));

      return json({
        success: true,
        message: 'Anuncio eliminado correctamente',
      });
    }

    return json({ success: false, error: 'Recurso no encontrado' }, 404);
  } catch (error) {
    return handleApiError(error);
  }
};

function normalizeApiPath(pathname: string): string {
  return pathname.replace(/^\/api/, '') || '/';
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      ...headers,
      'Cache-Control': 'no-store',
    },
  });
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError('El cuerpo de la peticion no es JSON valido', 400);
  }
}

async function getAuthenticatedUser(request: Request) {
  const token = getRequestToken(request);

  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  return authService.validateToken(BigInt(decoded.userId), decoded.email);
}

async function requireAuthenticatedUser(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw new AppError('No autorizado', 401);
  }

  return user;
}

function requireRole(user: { roles: string[] }, ...roles: string[]) {
  if (!user.roles.some((role) => roles.includes(role))) {
    throw new AppError('No tienes permisos para realizar esta accion', 403);
  }
}

function getQueryNumber(url: URL, key: string, fallback: number): number {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function readApplicationBody(request: Request): Promise<{
  data: ReturnType<typeof createApplicationSchema.parse>;
  attachments: ApplicationAttachmentInput[];
}> {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return {
      data: createApplicationSchema.parse(await readJsonBody(request)),
      attachments: [],
    };
  }

  const formData = await request.formData();
  const body: Record<string, FormDataEntryValue> = {};
  const attachments: ApplicationAttachmentInput[] = [];

  for (const [key, value] of formData.entries()) {
    if (key === 'attachments') {
      if (value instanceof File && value.size > 0) {
        attachments.push({
          fileName: `${Date.now()}-${value.name}`,
          originalName: value.name,
          mimeType: value.type || 'application/octet-stream',
          size: value.size,
          url: `/uploads/applications/${value.name}`,
        });
      }
      continue;
    }

    if (typeof value === 'string' && value !== '') {
      body[key] = value;
    }
  }

  return {
    data: createApplicationMultipartSchema.parse(body),
    attachments,
  };
}

function getRequestToken(request: Request): string | null {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const authHeader = request.headers.get('authorization');

  return (
    cookies.token ||
    (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null)
  );
}

function createAuthCookie(token: string): string {
  return [
    `token=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=604800',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function clearAuthCookie(): string {
  return [
    'token=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function handleApiError(error: unknown): Response {
  console.error(error);

  if (error instanceof ZodError) {
    return json({
      success: false,
      error: 'Error de validacion',
      details: error.errors.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    }, 400);
  }

  if (error instanceof AppError) {
    return json({
      success: false,
      error: error.message,
    }, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return json({
      success: false,
      error: 'Error de base de datos',
      code: error.code,
    }, 500);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return json({
      success: false,
      error: 'No se pudo inicializar Prisma. Revisa DATABASE_URL en Vercel y que la base de datos sea accesible desde internet.',
    }, 500);
  }

  return json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? undefined : getErrorMessage(error),
  }, 500);
}

type SerializedAdInput = Ad & {
  category?: Category | null;
  user?: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'city' | 'createdAt'> | null;
  images?: AdImage[];
  favoritedAt?: Date;
  _count?: {
    applications?: number;
  };
  isFavorited?: boolean;
  hasApplied?: boolean;
};

function serializeAd(ad: any) {
  return {
    id: ad.id.toString(),
    userId: ad.userId.toString(),
    categoryId: ad.categoryId.toString(),
    title: ad.title,
    description: ad.description,
    budgetMin: ad.budgetMin ? parseFloat(ad.budgetMin.toString()) : null,
    budgetMax: ad.budgetMax ? parseFloat(ad.budgetMax.toString()) : null,
    modality: ad.modality,
    location: ad.location,
    status: ad.status,
    publishedAt: ad.publishedAt,
    expiresAt: ad.expiresAt,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    favoritedAt: ad.favoritedAt,
    category: ad.category ? serializeCategory(ad.category) : null,
    user: ad.user
      ? {
          id: ad.user.id.toString(),
          fullName: ad.user.fullName,
          avatarUrl: ad.user.avatarUrl,
          city: ad.user.city,
          createdAt: ad.user.createdAt,
        }
      : null,
    images: ad.images?.map(serializeAdImage),
    applicationsCount: ad._count?.applications || 0,
    isFavorited: ad.isFavorited || false,
    hasApplied: ad.hasApplied || false,
  };
}

function serializeCategory(category: Category) {
  return {
    id: category.id.toString(),
    name: category.name,
    description: category.description,
  };
}

function serializeUser(user: any) {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles?.map((userRole: any) => userRole.role.name) || user.roles || [],
    professionalProfile: user.professionalProfile
      ? serializeProfessionalProfile(user.professionalProfile)
      : null,
    reviewsReceived: user.reviewsReceived?.map((review: any) => ({
      id: review.id.toString(),
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.reviewer
        ? {
            id: review.reviewer.id.toString(),
            fullName: review.reviewer.fullName,
            avatarUrl: review.reviewer.avatarUrl,
          }
        : null,
    })),
  };
}

function serializePublicProfile(profile: any) {
  return {
    id: profile.id.toString(),
    fullName: profile.fullName,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    createdAt: profile.createdAt,
    roles: profile.userRoles?.map((userRole: any) => userRole.role.name) || profile.roles || [],
    professionalProfile: profile.professionalProfile
      ? serializeProfessionalProfile(profile.professionalProfile)
      : null,
    averageRating: profile.averageRating || 0,
    totalReviews: profile.totalReviews || profile._count?.reviewsReceived || 0,
    reviewsReceived: profile.reviewsReceived?.map((review: any) => ({
      id: review.id.toString(),
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.reviewer
        ? {
            id: review.reviewer.id.toString(),
            fullName: review.reviewer.fullName,
            avatarUrl: review.reviewer.avatarUrl,
          }
        : null,
    })),
  };
}

function serializeProfessionalProfile(profile: any) {
  if (!profile) return null;

  return {
    id: profile.id.toString(),
    userId: profile.userId.toString(),
    description: profile.description,
    yearsExperience: profile.yearsExperience,
    hourlyRate: profile.hourlyRate ? parseFloat(profile.hourlyRate.toString()) : null,
    portfolioUrl: profile.portfolioUrl,
    availability: profile.availability,
    verified: profile.verified,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    user: profile.user
      ? {
          id: profile.user.id.toString(),
          fullName: profile.user.fullName,
          email: profile.user.email,
          phone: profile.user.phone,
          city: profile.user.city,
          avatarUrl: profile.user.avatarUrl,
          bio: profile.user.bio,
        }
      : undefined,
  };
}

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
          category: app.ad.category ? serializeCategory(app.ad.category) : null,
          user: app.ad.user
            ? {
                id: app.ad.user.id.toString(),
                fullName: app.ad.user.fullName,
                avatarUrl: app.ad.user.avatarUrl,
              }
            : null,
          images: app.ad.images?.map(serializeAdImage),
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
            ? serializeProfessionalProfile(app.professional.professionalProfile)
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

function serializeOrder(order: any) {
  return {
    id: order.id.toString(),
    applicationId: order.applicationId.toString(),
    clientUserId: order.clientUserId.toString(),
    professionalUserId: order.professionalUserId.toString(),
    agreedPrice: parseFloat(order.agreedPrice.toString()),
    startDate: order.startDate,
    endDate: order.endDate,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    canReview: order.canReview,
    hasReviewed: order.hasReviewed,
    hasReview: order.hasReview ?? (order._count?.reviews ? order._count.reviews > 0 : false),
    application: order.application
      ? {
          id: order.application.id.toString(),
          coverLetter: order.application.coverLetter,
          proposedPrice: order.application.proposedPrice
            ? parseFloat(order.application.proposedPrice.toString())
            : null,
          estimatedDays: order.application.estimatedDays,
          status: order.application.status,
          ad: order.application.ad
            ? {
                id: order.application.ad.id.toString(),
                title: order.application.ad.title,
                description: order.application.ad.description,
                status: order.application.ad.status,
                category: order.application.ad.category
                  ? serializeCategory(order.application.ad.category)
                  : null,
                images: order.application.ad.images?.map(serializeAdImage),
              }
            : null,
        }
      : null,
    client: order.client ? serializeOrderUser(order.client) : null,
    professional: order.professional
      ? {
          ...serializeOrderUser(order.professional),
          professionalProfile: order.professional.professionalProfile
            ? {
                yearsExperience: order.professional.professionalProfile.yearsExperience,
                verified: order.professional.professionalProfile.verified,
              }
            : null,
        }
      : null,
    reviews: order.reviews?.map(serializeReview),
    reviewsCount: order._count?.reviews || order.reviews?.length || 0,
  };
}

function serializeConversation(conversation: any) {
  return {
    id: conversation.id.toString(),
    adId: conversation.adId?.toString() || null,
    applicationId: conversation.applicationId?.toString() || null,
    orderId: conversation.orderId?.toString() || null,
    createdAt: conversation.createdAt,
    ad: conversation.ad
      ? {
          id: conversation.ad.id.toString(),
          title: conversation.ad.title,
        }
      : null,
    application: conversation.application
      ? {
          id: conversation.application.id.toString(),
          status: conversation.application.status,
        }
      : null,
    order: conversation.order
      ? {
          id: conversation.order.id.toString(),
          status: conversation.order.status,
        }
      : null,
    participants: conversation.participants?.map((participant: any) => ({
      userId: participant.userId.toString(),
      joinedAt: participant.joinedAt,
      user: participant.user
        ? {
            id: participant.user.id.toString(),
            fullName: participant.user.fullName,
            avatarUrl: participant.user.avatarUrl,
          }
        : null,
    })),
    messages: conversation.messages?.map(serializeMessage),
    lastMessage: conversation.lastMessage ? serializeMessage(conversation.lastMessage) : null,
    unreadCount: conversation.unreadCount || 0,
  };
}

function serializeMessage(message: any) {
  return {
    id: message.id.toString(),
    conversationId: message.conversationId.toString(),
    senderUserId: message.senderUserId.toString(),
    body: message.body,
    isRead: message.isRead,
    sentAt: message.sentAt,
    sender: message.sender
      ? {
          id: message.sender.id.toString(),
          fullName: message.sender.fullName,
          avatarUrl: message.sender.avatarUrl,
        }
      : null,
  };
}

function serializeNotification(notification: any) {
  return {
    id: notification.id.toString(),
    userId: notification.userId.toString(),
    title: notification.title,
    body: notification.body,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

function serializeReview(review: any) {
  return {
    id: review.id.toString(),
    orderId: review.orderId.toString(),
    reviewerUserId: review.reviewerUserId.toString(),
    reviewedUserId: review.reviewedUserId.toString(),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reviewer: review.reviewer
      ? {
          id: review.reviewer.id.toString(),
          fullName: review.reviewer.fullName,
          avatarUrl: review.reviewer.avatarUrl,
        }
      : null,
    reviewed: review.reviewed
      ? {
          id: review.reviewed.id.toString(),
          fullName: review.reviewed.fullName,
        }
      : null,
    order: review.order
      ? {
          id: review.order.id.toString(),
          application: review.order.application
            ? {
                ad: review.order.application.ad
                  ? {
                      id: review.order.application.ad.id.toString(),
                      title: review.order.application.ad.title,
                    }
                  : null,
              }
            : null,
        }
      : null,
  };
}

function serializeAdImage(image: any) {
  return {
    id: image.id.toString(),
    imageUrl: image.imageUrl,
    isMain: image.isMain,
    sortOrder: image.sortOrder,
  };
}

function serializeOrderUser(user: any) {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    city: user.city,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
