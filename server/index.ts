import { createServer } from 'http';
import { Server } from 'socket.io';

import app, { resolveCorsOrigin } from './app';
import { setupChatHandlers } from './socket/chatHandler';

const httpServer = createServer(app);

// Socket.IO setup for local/deployed Node server environments.
const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup Socket.IO handlers
setupChatHandlers(io);

const PORT = process.env.SERVER_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Socket.IO: ws://localhost:${PORT}`);
});

export { app, httpServer, io };
