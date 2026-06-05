import express, { Router } from 'express';
import cors, { type CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import adRoutes from './routes/ads';
import categoryRoutes from './routes/categories';
import applicationRoutes from './routes/applications';
import orderRoutes from './routes/orders';
import conversationRoutes from './routes/conversations';
import favoriteRoutes from './routes/favorites';
import reviewRoutes from './routes/reviews';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

const app = express();
const apiRouter = Router();
const corsOptions: CorsOptions = {
  origin: resolveCorsOrigin,
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/ads', adRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/applications', applicationRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/conversations', conversationRoutes);
apiRouter.use('/favorites', favoriteRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/admin', adminRoutes);

// Vercel can invoke the Express function with either /api/ads or /ads
// depending on the function route. Support both shapes without affecting Astro.
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Error handling
app.use('/api/*', notFoundHandler);
app.use('*', notFoundHandler);
app.use(errorHandler);

export default app;

const allowedFrontendOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    getVercelOrigin(process.env.VERCEL_URL),
    getVercelOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://0.0.0.0:4321',
    'http://[::1]:4321',
  ]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin))
);

export function resolveCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isAllowedFrontendOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin not allowed by CORS: ${origin}`));
}

function isAllowedFrontendOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (normalizedOrigin && allowedFrontendOrigins.has(normalizedOrigin)) {
    return true;
  }

  try {
    const url = new URL(origin);

    if (process.env.NODE_ENV === 'production') {
      return url.hostname.endsWith('.vercel.app');
    }

    return url.port === '4321' && isPrivateDevelopmentHost(url.hostname);
  } catch {
    return false;
  }
}

function getVercelOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`;
}

function normalizeOrigin(origin: string | undefined): string | undefined {
  if (!origin) {
    return undefined;
  }

  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

function isPrivateDevelopmentHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}
