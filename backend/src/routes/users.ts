import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { clearAuthCookie } from '../utils/jwt.js';
import { sendAccountDeletionEmail } from '../services/email.js';

const router = Router();

const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  pix_key: z.string().max(140).optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

// PATCH /api/users/me — atualizar perfil (revincula clientes se telefone mudou)
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = UpdateProfileSchema.parse(req.body);
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0)
      return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));

    const setClause = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const result = await query(
      `UPDATE users SET ${setClause}
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, email, full_name, phone, pix_key, avatar_url, role`,
      [req.user!.sub, ...fields.map(([, v]) => v)],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));

    if (body.phone !== undefined) {
      const { relinkCustomersForUser } = await import('../services/linking.js');
      await relinkCustomersForUser(req.user!.sub);
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

const DeleteAccountSchema = z.object({
  password: z.string().min(1),
  reason: z.string().optional(),
});

// DELETE /api/users/me
router.delete('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = DeleteAccountSchema.parse(req.body);
    const userId = req.user!.sub;

    const result = await query(
      'SELECT id, email, full_name, password_hash, google_id FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const user = result.rows[0];
    if (!user) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));

    // Validar senha (usuarios Google podem nao ter senha — aceitar sem validar)
    if (user.password_hash) {
      const valid = await bcrypt.compare(body.password, user.password_hash);
      if (!valid) return next(new ApiError(401, 'Senha incorreta', 'INVALID_PASSWORD'));
    }

    // Soft delete + anonimizar dados pessoais (LGPD)
    const anonEmail = `deleted_${userId}@removed.invalid`;
    await query(
      `UPDATE users SET
        deleted_at = NOW(),
        deleted_reason = $1,
        full_name = 'Conta removida',
        email = $2,
        phone = NULL,
        avatar_url = NULL,
        password_hash = NULL,
        google_id = NULL
       WHERE id = $3`,
      [body.reason || null, anonEmail, userId],
    );

    // Enviar email de confirmacao (para o email ORIGINAL antes de anonimizar)
    try {
      await sendAccountDeletionEmail(user.email, user.full_name);
    } catch (emailErr) {
      console.error('[Fiado PRO] Falha ao enviar email de exclusao:', emailErr);
      // Nao falha a requisicao por causa do email
    }

    // Limpar cookie de sessao
    clearAuthCookie(res);

    res.json({ success: true, message: 'Conta excluida com sucesso.' });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

export default router;
