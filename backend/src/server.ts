import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import geminiRoutes from './routes/gemini.js';
import healthRoutes from './routes/health.js';
import debtsRoutes from './routes/debts.js';
import usersRoutes from './routes/users.js';
import customersRoutes from './routes/customers.js';
import transactionsRoutes from './routes/transactions.js';
import syncRoutes from './routes/sync.js';
import inboxRoutes from './routes/inbox.js';
import adminRoutes from './routes/admin.js';
import { ensureAdminRole } from './services/linking.js';

// Import middleware
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimiter, authRateLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// ===== MIDDLEWARE =====

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ===== RATE LIMITING =====
app.use('/api/', rateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// ===== ROUTES =====

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', inboxRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// ===== SERVER =====

const server = app.listen(PORT, () => {
  // Bootstrap idempotente: promove o ADMIN_EMAIL a admin se a conta já existir
  void ensureAdminRole();
  console.log(`🚀 Fiado Pro Backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
