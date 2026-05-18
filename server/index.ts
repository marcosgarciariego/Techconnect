import express from 'express';
import cors, { type CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { setupChatHandlers } from './socket/chatHandler';

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
const httpServer = createServer(app);
const corsOptions: CorsOptions = {
  origin: resolveCorsOrigin,
  credentials: true,
};

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use('/api/*', notFoundHandler);
app.use(errorHandler);

// Setup Socket.IO handlers
setupChatHandlers(io);

const PORT = process.env.SERVER_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Socket.IO: ws://localhost:${PORT}`);
});

export { app, httpServer, io };

const allowedFrontendOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://0.0.0.0:4321',
    'http://[::1]:4321',
  ].filter((origin): origin is string => Boolean(origin))
);

function resolveCorsOrigin(
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
  if (!origin || allowedFrontendOrigins.has(origin)) {
    return true;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.port === '4321' && isPrivateDevelopmentHost(url.hostname);
  } catch {
    return false;
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
