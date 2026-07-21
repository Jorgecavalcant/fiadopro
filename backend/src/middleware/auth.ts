import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from './errorHandler.js';

export interface AuthRequest extends Request {
  user?: { sub: string; email: string };
}

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = (req as any).cookies?.fiado_token;
  if (!token) {
    return next(new ApiError(401, 'Authentication required', 'NO_TOKEN'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { sub: payload.sub, email: payload.email };
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid token';
    next(new ApiError(401, msg, 'INVALID_TOKEN'));
  }
};

/**
 * Exige role='admin' — SEMPRE consulta o banco (a role pode mudar após a
 * emissão do JWT; nunca confiar em claims para autorização de admin).
 * Usar sempre APÓS requireAuth.
 */
export const requireAdmin = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new ApiError(401, 'Authentication required', 'NO_TOKEN'));
    const { query } = await import('../config/database.js');
    const result = await query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [req.user.sub]
    );
    if (result.rows[0]?.role !== 'admin') {
      return next(new ApiError(403, 'Acesso restrito ao administrador', 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
};
