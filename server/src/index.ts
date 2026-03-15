import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { config } from './config/env';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/session.routes';
import statsRoutes from './routes/stats.routes';
import adminRoutes from './routes/admin.routes';
import { createSocketServer } from './signaling/socketServer';
import { cleanupExpiredSessions } from './services/session.service';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);

// Agent downloads
const downloadsDir = path.resolve(__dirname, '../../downloads');
app.use('/downloads', express.static(downloadsDir));

// Serve client build in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// SPA catch-all — must be after API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler
app.use(errorHandler);

// Database
runMigrations();

// Socket.IO signaling
createSocketServer(server);

// Cleanup expired sessions every 60 seconds
setInterval(() => {
  cleanupExpiredSessions();
}, 60_000);

// Start
server.listen(config.port, () => {
  console.log(`RemoteIT server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
