import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public extra?: { existingCustomerId?: string },
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';
  const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';

  if (err instanceof ApiError && err.code === 'DUPLICATE_PHONE') {
    console.error('[ERROR] DUPLICATE_PHONE');
  } else {
    console.error(`[ERROR] ${code}: ${message}`, err);
  }

  const extra = err instanceof ApiError ? err.extra : undefined;

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(extra?.existingCustomerId ? { existingCustomerId: extra.existingCustomerId } : {}),
      timestamp: new Date().toISOString(),
    },
  });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  });
};
