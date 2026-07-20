import { Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from './auth.js';
import { ApiError } from './errorHandler.js';

/**
 * ⚠️ PROVISÓRIO (frente ADMIN) ⚠️
 *
 * A frente CORE entrega `requireAdmin` oficial em `src/middleware/auth.ts`
 * (checa `users.role = 'admin'` no banco). Como essa migration/coluna ainda
 * não existe nesta worktree, esta é uma cópia IDÊNTICA ao contrato descrito
 * na SPEC (seção "Contratos da frente CORE"), usada só para não bloquear o
 * desenvolvimento das rotas /api/admin/*.
 *
 * INTEGRADOR: ao mesclar com a frente CORE, trocar o import
 *   import { requireAdmin } from '../middleware/requireAdmin.provisorio.js';
 * por
 *   import { requireAdmin } from '../middleware/auth.js';
 * em `src/routes/admin.ts`, e apagar este arquivo.
 */
export const requireAdmin = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.user?.sub) {
      return next(new ApiError(401, 'Authentication required', 'NO_TOKEN'));
    }
    const result = await query(
      'SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.sub]
    );
    const role = result.rows[0]?.role;
    if (role !== 'admin') {
      return next(new ApiError(403, 'Acesso restrito a administradores', 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
};
