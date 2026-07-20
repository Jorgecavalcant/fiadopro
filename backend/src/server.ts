import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import debtsRoutes from './routes/debts.js';
import usersRoutes from './routes/users.js';
import aiRoutes, { adminAiConfigRouter } from './routes/ai.js';

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
// Limite maior só para /api/ai/read-document: imagem/documento em base64 (até
// 10MB de arquivo real) infla ~33% + overhead do envelope JSON. Como o
// body-parser marca `req._body` após parsear, o parser geral abaixo (10mb)
// não reprocessa a mesma requisição — só as demais rotas ficam com o limite padrão.
app.use('/api/ai/read-document', express.json({ limit: '15mb' }));
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
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminAiConfigRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// ===== SERVER =====

const server = app.listen(PORT, () => {
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
