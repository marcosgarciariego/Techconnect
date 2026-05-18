const DEFAULT_API_URL = 'http://localhost:3001/api';
const CONFIGURED_API_URL = import.meta.env.PUBLIC_API_URL || DEFAULT_API_URL;
const DEFAULT_SOCKET_URL = 'http://localhost:3001';
const CONFIGURED_SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL || DEFAULT_SOCKET_URL;

interface ApiOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);
  if (!isFormDataBody(fetchOptions.body)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    throw new ApiError(
      'No se pudo conectar con la API. Comprueba que el servidor backend esté iniciado en el puerto 3001.',
      0,
      error
    );
  }

  const rawBody = await response.text();
  const data = parseResponseBody(rawBody, response.headers.get('content-type'));

  if (!response.ok) {
    throw new ApiError(
      getApiErrorMessage(data, response, rawBody),
      response.status,
      data ?? rawBody
    );
  }

  if (data === null) {
    if (!rawBody.trim()) {
      return {} as T;
    }

    throw new ApiError(
      getUnexpectedResponseMessage(response, rawBody),
      response.status,
      rawBody
    );
  }

  return data as T;
}

export function getApiUrl(): string {
  return resolveHostAwareUrl(CONFIGURED_API_URL);
}

export function getSocketUrl(): string {
  return resolveHostAwareUrl(CONFIGURED_SOCKET_URL);
}

function resolveHostAwareUrl(configuredUrl: string): string {
  if (typeof window === 'undefined') {
    return normalizeApiUrl(configuredUrl);
  }

  try {
    const apiUrl = new URL(configuredUrl, window.location.origin);
    const currentHostname = window.location.hostname;

    if (isLocalHostname(apiUrl.hostname) && !isLocalHostname(currentHostname)) {
      apiUrl.hostname = currentHostname;
    }

    return normalizeApiUrl(apiUrl.toString());
  } catch {
    return normalizeApiUrl(configuredUrl);
  }
}

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function parseResponseBody(body: string, contentType: string | null): any {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return null;
  }

  const looksLikeJson =
    contentType?.includes('application/json') ||
    trimmedBody.startsWith('{') ||
    trimmedBody.startsWith('[');

  if (!looksLikeJson) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody);
  } catch {
    return null;
  }
}

function getApiErrorMessage(data: any, response: Response, rawBody: string): string {
  if (data?.details?.[0]?.message) {
    return data.details[0].message;
  }

  if (typeof data?.error === 'string' && data.error) {
    return data.error;
  }

  if (typeof data?.message === 'string' && data.message) {
    return data.message;
  }

  return getUnexpectedResponseMessage(response, rawBody);
}

function getUnexpectedResponseMessage(response: Response, rawBody: string): string {
  const trimmedBody = rawBody.trim();

  if (trimmedBody.startsWith('<')) {
    return `La API devolvio HTML inesperado (${response.status})`;
  }

  if (trimmedBody) {
    return trimmedBody;
  }

  return `La API devolvio una respuesta no valida (${response.status})`;
}

// Auth endpoints
export const authApi = {
  register: (data: any) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  me: () => api('/auth/me'),
  validate: () => api('/auth/validate'),
};

// User endpoints
export const userApi = {
  getProfile: () => api('/users/profile'),
  updateProfile: (data: any) =>
    api('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getPublicProfile: (id: string) => api(`/users/${id}`),
  getProfessionalProfile: () => api('/users/professional/me'),
  updateProfessionalProfile: (data: any) =>
    api('/users/professional/me', { method: 'PUT', body: JSON.stringify(data) }),
  listProfessionals: (params?: URLSearchParams) =>
    api(`/users/professionals/list?${params?.toString() || ''}`),
};

// Ad endpoints
export const adApi = {
  list: (params?: URLSearchParams) => api(`/ads?${params?.toString() || ''}`),
  get: (id: string) => api(`/ads/${id}`),
  create: (data: any) =>
    api('/ads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    api(`/ads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/ads/${id}`, { method: 'DELETE' }),
  getUserAds: (params?: URLSearchParams) =>
    api(`/ads/user/mine?${params?.toString() || ''}`),
};

// Category endpoints
export const categoryApi = {
  list: () => api('/categories'),
  get: (id: string) => api(`/categories/${id}`),
};

// Application endpoints
export const applicationApi = {
  create: (data: any) =>
    api('/applications', {
      method: 'POST',
      body: isFormDataPayload(data) ? data : JSON.stringify(data),
    }),
  get: (id: string) => api(`/applications/${id}`),
  updateStatus: (id: string, status: string) =>
    api(`/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getForAd: (adId: string, params?: URLSearchParams) =>
    api(`/applications/ad/${adId}?${params?.toString() || ''}`),
  getMine: (params?: URLSearchParams) =>
    api(`/applications/professional/mine?${params?.toString() || ''}`),
  getReceived: (params?: URLSearchParams) =>
    api(`/applications/received/mine?${params?.toString() || ''}`),
};

function isFormDataPayload(data: unknown): data is FormData {
  return typeof FormData !== 'undefined' && data instanceof FormData;
}

// Order endpoints
export const orderApi = {
  create: (data: any) =>
    api('/orders', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => api(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getClientOrders: (params?: URLSearchParams) =>
    api(`/orders/client/mine?${params?.toString() || ''}`),
  getProfessionalOrders: (params?: URLSearchParams) =>
    api(`/orders/professional/mine?${params?.toString() || ''}`),
};

// Conversation endpoints
export const conversationApi = {
  list: (params?: URLSearchParams) =>
    api(`/conversations?${params?.toString() || ''}`),
  get: (id: string) => api(`/conversations/${id}`),
  create: (data: any) =>
    api('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  getForApplication: (applicationId: string) =>
    api(`/conversations/application/${applicationId}`),
  sendMessage: (id: string, body: string) =>
    api(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  markAsRead: (id: string) =>
    api(`/conversations/${id}/read`, { method: 'POST' }),
  getUnreadCount: () => api('/conversations/unread/count'),
};

// Favorite endpoints
export const favoriteApi = {
  list: (params?: URLSearchParams) =>
    api(`/favorites?${params?.toString() || ''}`),
  add: (adId: string) => api(`/favorites/${adId}`, { method: 'POST' }),
  remove: (adId: string) => api(`/favorites/${adId}`, { method: 'DELETE' }),
  toggle: (adId: string) => api(`/favorites/${adId}/toggle`, { method: 'POST' }),
  check: (adId: string) => api(`/favorites/${adId}/check`),
};

// Review endpoints
export const reviewApi = {
  create: (data: any) =>
    api('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => api(`/reviews/${id}`),
  getUserReviews: (userId: string, params?: URLSearchParams) =>
    api(`/reviews/user/${userId}?${params?.toString() || ''}`),
  getUserStats: (userId: string) => api(`/reviews/user/${userId}/stats`),
  getGiven: (params?: URLSearchParams) =>
    api(`/reviews/given/mine?${params?.toString() || ''}`),
  getReceived: (params?: URLSearchParams) =>
    api(`/reviews/received/mine?${params?.toString() || ''}`),
};

// Notification endpoints
export const notificationApi = {
  list: (params?: URLSearchParams) =>
    api(`/notifications?${params?.toString() || ''}`),
  getUnreadCount: () => api('/notifications/unread/count'),
  markAsRead: (id: string) =>
    api(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: () => api('/notifications/read-all', { method: 'POST' }),
  delete: (id: string) => api(`/notifications/${id}`, { method: 'DELETE' }),
};

// Admin endpoints
export const adminApi = {
  getStats: () => api('/admin/stats'),
  listUsers: (params?: URLSearchParams) =>
    api(`/admin/users?${params?.toString() || ''}`),
  toggleUserActive: (id: string, isActive: boolean) =>
    api(`/admin/users/${id}/toggle-active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  addRole: (userId: string, roleName: string) =>
    api(`/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleName }),
    }),
  removeRole: (userId: string, roleName: string) =>
    api(`/admin/users/${userId}/roles/${roleName}`, { method: 'DELETE' }),
  listAds: (params?: URLSearchParams) =>
    api(`/admin/ads?${params?.toString() || ''}`),
  updateAdStatus: (id: string, status: string) =>
    api(`/admin/ads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteAd: (id: string) => api(`/admin/ads/${id}`, { method: 'DELETE' }),
  createCategory: (data: any) =>
    api('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) =>
    api(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    api(`/admin/categories/${id}`, { method: 'DELETE' }),
  getAuditLogs: (params?: URLSearchParams) =>
    api(`/admin/audit-logs?${params?.toString() || ''}`),
  getRecentAuditLogs: (limit?: number) =>
    api(`/admin/audit-logs/recent?limit=${limit || 10}`),
};
