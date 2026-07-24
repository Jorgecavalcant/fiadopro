import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

export const createLimiter = (
  maxRequests: number,
  windowMs: number,
  keyFn?: (req: Request) => string,
) => {
  const store = new Map<string, RateLimitStore>();

  // Limpa entradas expiradas a cada 5 minutos
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, val] of store.entries()) {
        if (val.resetAt < now) store.delete(key);
      }
    },
    5 * 60 * 1000,
  );

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : req.ip || 'unknown';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT',
          message: `Muitas requisições. Tente novamente em ${retryAfter}s.`,
        },
      });
    }

    entry.count++;
    next();
  };
};

// Limite geral: 100 req/min por IP
export const rateLimiter = createLimiter(100, 60 * 1000);

// Limite para auth: 10 tentativas/15min por IP (proteção brute force)
export const authRateLimiter = createLimiter(10, 15 * 60 * 1000);
