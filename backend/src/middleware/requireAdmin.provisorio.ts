// PROVISÓRIO — a frente CORE ainda não mergeou a migration 002/003 (users.role)
// neste worktree. Este middleware já implementa o contrato definitivo da SPEC
// (checar `role = 'admin'` em `users`) e cai para o fallback `ADMIN_EMAIL`
// somente enquanto a coluna `role` não existir (erro Postgres 42703).
//
// Assim que a frente CORE mergear e `users.role` existir em produção, o fallback
// nunca mais é acionado (a query normal passa a resolver sozinha) — dá para
// apagar este arquivo e trocar pelo `requireAdmin` real de `src/middleware/auth.ts`
// sem nenhuma mudança de comportamento observável.
import { Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from './auth.js';
import { ApiError } from './errorHandler.js';

const UNDEFINED_COLUMN = '42703';

export const requireAdmin = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required', 'NO_TOKEN'));
  }

  try {
    const result = await query('SELECT role FROM users WHERE id = $1', [req.user.sub]);
    const role = result.rows[0]?.role;
    if (role === 'admin') return next();
    return next(new ApiError(403, 'Acesso restrito a administradores', 'FORBIDDEN'));
  } catch (err) {
    const pgCode = (err as { code?: string } | undefined)?.code;
    if (pgCode === UNDEFINED_COLUMN) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && req.user.email?.toLowerCase() === adminEmail.toLowerCase()) {
        return next();
      }
      return next(new ApiError(403, 'Acesso restrito a administradores', 'FORBIDDEN'));
    }
    next(err);
  }
};
