import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { clearAuthCookie } from '../utils/jwt.js';
import { sendAccountDeletionEmail } from '../services/email.js';
import {
  confirmAccountDeletion,
  confirmImmediateDeletion,
  purgeUserDataNow,
  unlinkCustomersForUser,
} from '../services/accountPurge.js';
import { isLastActiveAdmin, LAST_ADMIN_DELETE_MESSAGE } from '../services/lastAdmin.js';

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
    const phoneChanged = body.phone !== undefined;
    // Trocar telefone limpa a verificação — celular só vincula se verificado (confirm-email) ou se o e-mail também bater.
    const result = await query(
      `UPDATE users SET ${setClause}${phoneChanged ? ', phone_verified_at = NULL' : ''}
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, email, full_name, phone, pix_key, avatar_url, role`,
      [req.user!.sub, ...fields.map(([, v]) => v)],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));

    if (phoneChanged) {
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
  mode: z.enum(['scheduled', 'immediate']).optional().default('scheduled'),
  confirmation: z.string().optional(),
  password: z.string().optional(),
  reason: z.string().optional(),
});

// DELETE /api/users/me
router.delete('/me', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = DeleteAccountSchema.parse(req.body);
    const userId = req.user!.sub;

    const result = await query(
      'SELECT id, email, full_name, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const user = result.rows[0];
    if (!user) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));

    const confirmation = body.confirmation ?? body.password ?? '';
    let passwordMatches = false;
    if (user.password_hash) {
      // immediate: password field is reauth; scheduled: confirmation carries the password (compat)
      const secret = body.mode === 'immediate' ? (body.password ?? '') : confirmation;
      passwordMatches = await bcrypt.compare(secret, user.password_hash);
    }

    if (body.mode === 'immediate') {
      const confirmationError = confirmImmediateDeletion(user, body.confirmation ?? '', passwordMatches);
      if (confirmationError) {
        const message = confirmationError === 'INVALID_PASSWORD'
          ? 'Senha incorreta'
          : 'Confirmacao invalida';
        return next(new ApiError(401, message, confirmationError));
      }
    } else {
      const confirmationError = confirmAccountDeletion(user, body.confirmation ?? '', passwordMatches);
      if (confirmationError) {
        const message = confirmationError === 'INVALID_PASSWORD'
          ? 'Senha incorreta'
          : 'Confirmacao invalida';
        return next(new ApiError(401, message, confirmationError));
      }
    }

    if (await isLastActiveAdmin(userId)) {
      return next(new ApiError(409, LAST_ADMIN_DELETE_MESSAGE, 'LAST_ADMIN'));
    }

    const hold = await query('SELECT legal_hold FROM users WHERE id = $1', [userId]);
    if (hold.rows[0]?.legal_hold === true) {
      const status = body.mode === 'immediate' ? 403 : 409;
      return next(new ApiError(
        status,
        'Esta conta está sob bloqueio judicial e não pode ser encerrada até um administrador liberar.',
        'LEGAL_HOLD',
      ));
    }

    await query(
      `UPDATE users SET
        deleted_at = NOW(),
        purge_after = ${body.mode === 'immediate' ? 'NOW()' : "NOW() + INTERVAL '30 days'"},
        deleted_reason = $1,
        cpf = NULL,
        pix_key = NULL,
        is_active = false,
        login_retained = true
       WHERE id = $2 AND deleted_at IS NULL`,
      [body.reason || null, userId],
    );

    try {
      await query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1', [userId]);
    } catch (tokenErr) {
      const message = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      console.error('[Fiado PRO] Falha ao invalidar tokens de redefinicao:', message);
    }

    if (body.mode === 'immediate') {
      await purgeUserDataNow(userId);
    } else {
      await unlinkCustomersForUser(userId);
    }

    try {
      await sendAccountDeletionEmail(user.email, user.full_name);
    } catch (emailErr) {
      const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('[Fiado PRO] Falha ao enviar email de exclusao:', message);
    }

    clearAuthCookie(res);

    res.json({
      success: true,
      message: body.mode === 'immediate'
        ? 'Conta excluída imediatamente.'
        : 'Conta desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail.',
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

export default router;
