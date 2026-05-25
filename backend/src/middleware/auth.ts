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
