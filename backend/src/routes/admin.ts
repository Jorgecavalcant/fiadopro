import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { isLastActiveAdmin, LAST_ADMIN_BLOCK_MESSAGE } from '../services/lastAdmin.js';
import {
  BLOCK_REASONS,
  insertAuditEntry,
  listAdminAudit,
  updateAdminUser,
  withTransaction,
} from '../services/adminAudit.js';

const router = Router();

// Todas as rotas de admin exigem sessão válida + role='admin'
router.use(requireAuth, requireAdmin);

const SAFE_USER_FIELDS = `id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at,
  block_reason, block_note, legal_hold, blocked_at`;

const SETTINGS_ALLOWLIST = ['features', 'limits', 'geral'] as const;

// ===================== USERS =====================

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});

// GET /api/admin/users — paginação + busca por nome/email. NUNCA expõe password_hash.
router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search } = ListUsersQuerySchema.parse(req.query);
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    let whereClause = 'WHERE (deleted_at IS NULL OR legal_hold IS TRUE)';
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total ?? 0;

    const listParams = [...params, limit, offset];
    const usersResult = await query(
      `SELECT ${SAFE_USER_FIELDS} FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    res.json({
      success: true,
      users: usersResult.rows,
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

const UpdateUserSchema = z
  .object({
    full_name: z.string().min(2).max(100).optional(),
    phone: z.string().max(20).nullable().optional(),
    is_active: z.boolean().optional(),
    block_reason: z.enum(BLOCK_REASONS).optional(),
    block_note: z.string().max(500).optional(),
    unblock_note: z.string().max(500).optional(),
  })
  .strict()
  .refine((data) => data.full_name !== undefined || data.phone !== undefined || data.is_active !== undefined, {
    message: 'Informe ao menos um campo para atualizar (full_name, phone ou is_active)',
  });

// PATCH /api/admin/users/:id — is_active, full_name, phone. Proibido mudar role por aqui.
router.patch('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'role')) {
      return next(
        new ApiError(400, 'Não é permitido alterar role por esta rota', 'ROLE_CHANGE_FORBIDDEN'),
      );
    }
    const body = UpdateUserSchema.parse(req.body);

    if (body.is_active === false && (await isLastActiveAdmin(req.params.id))) {
      return next(new ApiError(409, LAST_ADMIN_BLOCK_MESSAGE, 'LAST_ADMIN'));
    }

    const result = await updateAdminUser(req.user!.sub, req.params.id, body);
    if (result.error) return next(result.error);
    res.json({ success: true, user: result.user });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// POST /api/admin/users/:id/reset-password — gera token e envia e-mail (padrão do forgot-password)
router.post(
  '/users/:id/reset-password',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        'SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = true',
        [req.params.id],
      );
      const user = result.rows[0];
      if (!user)
        return next(new ApiError(404, 'Usuário não encontrado ou inativo', 'USER_NOT_FOUND'));

      const { v4: uuidv4 } = await import('uuid');
      const token = uuidv4().replace(/-/g, '');
      await withTransaction(async (sql) => {
        await sql(
          'UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
          [user.id],
        );
        await sql('INSERT INTO password_reset_tokens (user_id, token) VALUES ($1, $2)', [
          user.id,
          token,
        ]);
        await insertAuditEntry(sql, {
          adminId: req.user!.sub,
          action: 'user.reset_password',
          targetUserId: user.id,
          reason: null,
          note: null,
          beforeState: { reset: false },
          afterState: { reset: true },
          keepWhileOrderStands: false,
        });
      });
      await sendPasswordResetEmail(user.email, token);

      res.json({ success: true, message: 'E-mail de redefinição de senha enviado.' });
    } catch (err) {
      next(err);
    }
  },
);

const AUDIT_ACTIONS = [
  'user.block',
  'user.unblock',
  'user.update',
  'user.reset_password',
  'settings.update',
] as const;

const AuditQuerySchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get('/audit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = AuditQuerySchema.parse({
      action: req.query.action || undefined,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      page: req.query.page,
      limit: req.query.limit,
    });
    const data = await listAdminAudit(filters);
    res.json({ success: true, ...data });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, 'Filtro inválido.', 'VALIDATION_ERROR'));
    next(err);
  }
});

// ===================== METRICS =====================

// GET /api/admin/metrics — contagens + volume por mês (últimos 12 meses)
router.get('/metrics', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [activeUsers, customersCount, transactionsCount, monthlyVolume] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total FROM users WHERE is_active = true AND deleted_at IS NULL`,
      ),
      query(`SELECT COUNT(*)::int AS total FROM customers WHERE deleted_at IS NULL`),
      query(`SELECT COUNT(*)::int AS total FROM transactions`),
      query(`
        SELECT
          to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS month,
          COALESCE(SUM(amount), 0)::numeric AS volume,
          COUNT(*)::int AS count
        FROM transactions
        WHERE occurred_at >= date_trunc('month', NOW()) - INTERVAL '11 months'
          AND status = 'CONFIRMED'
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

    res.json({
      success: true,
      metrics: {
        activeUsers: activeUsers.rows[0]?.total ?? 0,
        customers: customersCount.rows[0]?.total ?? 0,
        transactions: transactionsCount.rows[0]?.total ?? 0,
        monthlyVolume: monthlyVolume.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ===================== SETTINGS =====================

const SettingsKeyParamSchema = z.object({
  key: z.enum(SETTINGS_ALLOWLIST, {
    errorMap: () => ({ message: `Chave inválida. Permitidas: ${SETTINGS_ALLOWLIST.join(', ')}` }),
  }),
});

const SettingsValueSchema = z
  .object({ value: z.unknown() })
  .refine((data) => data.value !== undefined, { message: 'Campo "value" é obrigatório' });

// GET /api/admin/settings/:key
router.get('/settings/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = SettingsKeyParamSchema.parse({ key: req.params.key });
    const result = await query('SELECT value, updated_at FROM app_settings WHERE key = $1', [key]);
    if (!result.rows[0]) {
      return res.json({ success: true, key, value: null, updated_at: null });
    }
    res.json({
      success: true,
      key,
      value: result.rows[0].value,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// PUT /api/admin/settings/:key
router.put('/settings/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = SettingsKeyParamSchema.parse({ key: req.params.key });
    const { value } = SettingsValueSchema.parse(req.body);

    const result = await withTransaction(async (sql) => {
      const saved = await sql(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
         RETURNING key, value, updated_at`,
        [key, JSON.stringify(value)],
      );
      await insertAuditEntry(sql, {
        adminId: req.user!.sub,
        action: 'settings.update',
        targetUserId: null,
        reason: null,
        note: null,
        beforeState: { key },
        afterState: { key },
        keepWhileOrderStands: false,
      });
      return saved.rows[0];
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// ===================== REPORTS =====================

const ReportsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).default(12),
});

// GET /api/admin/reports?months=N (N<=60) — agregado de transações por mês/tipo
router.get('/reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { months } = ReportsQuerySchema.parse(req.query);
    const result = await query(
      `SELECT
         to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS month,
         type,
         COALESCE(SUM(amount), 0)::numeric AS total,
         COUNT(*)::int AS count
       FROM transactions
       WHERE occurred_at >= date_trunc('month', NOW()) - ($1::int - 1) * INTERVAL '1 month'
       GROUP BY 1, type
       ORDER BY 1, type`,
      [months],
    );
    res.json({ success: true, months, report: result.rows });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

export default router;
