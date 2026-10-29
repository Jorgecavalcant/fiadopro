import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { maskPersonName } from './accountAccess.js';
import { insertAuditEntry, validateRequiredNote, withTransaction } from './adminAudit.js';
import { TRIAL_DAYS } from './plans.js';

type Sql = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type GrantKind = 'cortesia' | 'trial' | 'cupom';
export type GrantedPlan = 'PRO' | 'ENTERPRISE';
export type PromotionAudience = 'all' | 'selected';
export type PromotionSource = 'promocao' | 'cupom';

export type IndividualGrantInput = {
  userId: string;
  kind: GrantKind;
  plan?: GrantedPlan;
  expiresAt?: string | null;
  note: string;
};

export type PromotionInput = {
  plan: GrantedPlan;
  expiresAt: string;
  audience: PromotionAudience;
  userIds?: string[];
  note: string;
  source?: PromotionSource;
};

export type ListedGrant = {
  id: string;
  name: string;
  plan: string;
  source: string;
  expiresAt: string | null;
};

export type ListedPromotion = {
  id: string;
  plan: string;
  source: string;
  audience: string;
  expiresAt: string;
  userCount: number;
};

const GRANT_ACTION: Record<GrantKind, string> = {
  cortesia: 'grant.cortesia',
  trial: 'grant.trial',
  cupom: 'grant.cupom',
};

const PLAN_MESSAGE = 'Informe o plano Pro ou Enterprise.';
const NOT_FOUND = 'Pessoa não encontrada.';

export function validateGrantNote(note: string | undefined): string | null {
  const problem = validateRequiredNote(note);
  if (problem) return problem;
  if ((note ?? '').includes('@')) {
    return 'Não coloque e-mail na observação.';
  }
  return null;
}

export function parseFutureExpiry(
  value: string | null | undefined,
  required: boolean,
): { ok: true; expiresAt: string | null } | { ok: false; message: string } {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    if (required) return { ok: false, message: 'Informe um prazo futuro.' };
    return { ok: true, expiresAt: null };
  }
  const time = new Date(text).getTime();
  if (Number.isNaN(time) || time <= Date.now()) {
    return { ok: false, message: 'O prazo precisa ser uma data futura.' };
  }
  return { ok: true, expiresAt: new Date(time).toISOString() };
}

function isGrantedPlan(value: string | undefined): value is GrantedPlan {
  return value === 'PRO' || value === 'ENTERPRISE';
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const time = new Date(value as string | Date).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

function grantState(row: Record<string, unknown> | undefined): Record<string, unknown> {
  return {
    grant_plan: textOrNull(row?.grant_plan),
    grant_source: textOrNull(row?.grant_source),
    grant_expires_at: toIso(row?.grant_expires_at),
    paid_plan: textOrNull(row?.plan),
    paid_until: toIso(row?.current_period_end),
  };
}

async function requireOpenUser(sql: Sql, userId: string) {
  const found = await sql(`SELECT id, deleted_at FROM users WHERE id = $1 FOR UPDATE`, [userId]);
  const row = found.rows[0];
  if (!row || row.deleted_at) {
    throw new ApiError(404, NOT_FOUND, 'USER_NOT_FOUND');
  }
}

async function applyGrant(
  sql: Sql,
  input: {
    userId: string;
    plan: GrantedPlan;
    source: GrantKind;
    expiresAt: string | null;
    trialDays?: number;
    adminId: string;
    note: string;
  },
) {
  const beforeRow = await sql(
    `SELECT plan, current_period_end, grant_plan, grant_source, grant_expires_at
       FROM subscriptions
      WHERE user_id = $1`,
    [input.userId],
  );
  const before = grantState(beforeRow.rows[0]);

  await sql(
    `INSERT INTO subscriptions (user_id, plan)
     VALUES ($1, 'FREE')
     ON CONFLICT (user_id) DO NOTHING`,
    [input.userId],
  );

  const updated = input.trialDays
    ? await sql(
        `UPDATE subscriptions
            SET grant_plan = $2,
                grant_source = $3,
                grant_expires_at = NOW() + ($4::int * INTERVAL '1 day'),
                granted_by = $5,
                updated_at = NOW()
          WHERE user_id = $1
          RETURNING plan, current_period_end, grant_plan, grant_source, grant_expires_at`,
        [input.userId, input.plan, input.source, input.trialDays, input.adminId],
      )
    : await sql(
        `UPDATE subscriptions
            SET grant_plan = $2,
                grant_source = $3,
                grant_expires_at = $4,
                granted_by = $5,
                updated_at = NOW()
          WHERE user_id = $1
          RETURNING plan, current_period_end, grant_plan, grant_source, grant_expires_at`,
        [input.userId, input.plan, input.source, input.expiresAt, input.adminId],
      );

  const saved = updated.rows[0];
  if (!saved) throw new ApiError(404, NOT_FOUND, 'USER_NOT_FOUND');
  const after = grantState(saved);

  await insertAuditEntry(sql, {
    adminId: input.adminId,
    action: GRANT_ACTION[input.source],
    targetUserId: input.userId,
    reason: null,
    note: input.note,
    beforeState: before,
    afterState: after,
    keepWhileOrderStands: false,
  });

  return {
    userId: input.userId,
    plan: after.grant_plan,
    source: after.grant_source,
    expiresAt: after.grant_expires_at,
  };
}

export async function grantPlan(adminId: string, input: IndividualGrantInput) {
  const noteError = validateGrantNote(input.note);
  if (noteError) throw new ApiError(400, noteError, 'VALIDATION_ERROR');
  const note = input.note.trim();

  if (input.kind === 'trial') {
    return withTransaction(async (sql) => {
      await requireOpenUser(sql, input.userId);
      const claimed = await sql(
        `UPDATE users
            SET trial_used_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
            AND deleted_at IS NULL
            AND trial_used_at IS NULL
          RETURNING id`,
        [input.userId],
      );
      if (!claimed.rows[0]) {
        throw new ApiError(409, 'Esta pessoa já usou o teste grátis.', 'TRIAL_ALREADY_USED');
      }
      return applyGrant(sql, {
        userId: input.userId,
        plan: 'PRO',
        source: 'trial',
        expiresAt: null,
        trialDays: TRIAL_DAYS,
        adminId,
        note,
      });
    });
  }

  if (!isGrantedPlan(input.plan)) {
    throw new ApiError(400, PLAN_MESSAGE, 'VALIDATION_ERROR');
  }
  const expiry = parseFutureExpiry(input.expiresAt, input.kind === 'cupom');
  if (!expiry.ok) throw new ApiError(400, expiry.message, 'VALIDATION_ERROR');

  return withTransaction(async (sql) => {
    await requireOpenUser(sql, input.userId);
    return applyGrant(sql, {
      userId: input.userId,
      plan: input.plan as GrantedPlan,
      source: input.kind,
      expiresAt: expiry.expiresAt,
      adminId,
      note,
    });
  });
}

export async function createPromotion(adminId: string, input: PromotionInput) {
  const noteError = validateGrantNote(input.note);
  if (noteError) throw new ApiError(400, noteError, 'VALIDATION_ERROR');
  const note = input.note.trim();
  const source: PromotionSource = input.source ?? 'promocao';
  if (source !== 'promocao' && source !== 'cupom') {
    throw new ApiError(400, 'Informe a origem promoção ou cupom.', 'VALIDATION_ERROR');
  }
  if (!isGrantedPlan(input.plan)) {
    throw new ApiError(400, PLAN_MESSAGE, 'VALIDATION_ERROR');
  }
  if (input.audience !== 'all' && input.audience !== 'selected') {
    throw new ApiError(
      400,
      'Informe se a promoção vale para a base inteira ou para uma lista.',
      'VALIDATION_ERROR',
    );
  }

  const expiry = parseFutureExpiry(input.expiresAt, true);
  if (!expiry.ok) throw new ApiError(400, expiry.message, 'VALIDATION_ERROR');

  const ids = [...new Set(input.userIds ?? [])];
  if (input.audience === 'all' && ids.length > 0) {
    throw new ApiError(
      400,
      'A promoção da base inteira não usa lista de pessoas.',
      'VALIDATION_ERROR',
    );
  }
  if (input.audience === 'selected' && ids.length === 0) {
    throw new ApiError(400, 'Informe ao menos uma pessoa na lista.', 'VALIDATION_ERROR');
  }

  return withTransaction(async (sql) => {
    if (input.audience === 'selected') {
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
      const found = await sql(
        `SELECT id::text AS id
           FROM users
          WHERE deleted_at IS NULL
            AND id IN (${placeholders})
          FOR UPDATE`,
        ids,
      );
      if (found.rows.length !== ids.length) {
        throw new ApiError(404, NOT_FOUND, 'USER_NOT_FOUND');
      }
    }

    const inserted = await sql(
      `INSERT INTO plan_promotions (plan, source, expires_at, audience, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, plan, source, audience, expires_at`,
      [input.plan, source, expiry.expiresAt, input.audience, adminId],
    );
    const promo = inserted.rows[0];
    if (!promo) {
      throw new ApiError(
        500,
        'Ocorreu um erro interno. Nossa equipe já foi notificada.',
        'INTERNAL_ERROR',
      );
    }

    if (input.audience === 'selected') {
      for (const userId of ids) {
        await sql(`INSERT INTO plan_promotion_users (promotion_id, user_id) VALUES ($1, $2)`, [
          promo.id,
          userId,
        ]);
      }
    }

    let userCount = ids.length;
    if (input.audience === 'all') {
      const counted = await sql(
        `SELECT COUNT(*)::int AS total FROM users WHERE deleted_at IS NULL`,
      );
      userCount = Number(counted.rows[0]?.total ?? 0);
    }

    const beforeState: Record<string, unknown> = {
      plan: null,
      audience: null,
      expires_at: null,
      user_count: 0,
    };
    const after: Record<string, unknown> = {
      plan: input.plan,
      audience: input.audience,
      expires_at: toIso(promo.expires_at) ?? expiry.expiresAt,
      user_count: userCount,
    };

    await insertAuditEntry(sql, {
      adminId,
      action: 'promotion.create',
      targetUserId: null,
      reason: null,
      note,
      beforeState,
      afterState: after,
      keepWhileOrderStands: false,
    });

    return {
      id: String(promo.id),
      plan: input.plan,
      source,
      audience: input.audience,
      expiresAt: String(after.expires_at),
      userCount,
    };
  });
}

export async function listPlanGrants(): Promise<{
  grants: ListedGrant[];
  promotions: ListedPromotion[];
}> {
  const grants = await query(
    `SELECT u.id, u.full_name, s.grant_plan, s.grant_source, s.grant_expires_at
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
      WHERE u.deleted_at IS NULL
        AND s.grant_plan IN ('PRO', 'ENTERPRISE')
        AND (
          (s.grant_source = 'trial' AND s.grant_expires_at > NOW())
          OR (
            s.grant_source IN ('cortesia', 'cupom', 'promocao')
            AND (s.grant_expires_at IS NULL OR s.grant_expires_at > NOW())
          )
        )
      ORDER BY s.grant_expires_at NULLS LAST, u.id`,
  );

  const promotions = await query(
    `SELECT p.id, p.plan, p.source, p.audience, p.expires_at,
            CASE
              WHEN p.audience = 'selected' THEN (
                SELECT COUNT(*)::int FROM plan_promotion_users pu WHERE pu.promotion_id = p.id
              )
              ELSE (
                SELECT COUNT(*)::int FROM users u WHERE u.deleted_at IS NULL
              )
            END AS user_count
       FROM plan_promotions p
      WHERE p.starts_at <= NOW()
        AND p.expires_at > NOW()
      ORDER BY p.expires_at, p.id`,
  );

  return {
    grants: grants.rows.map((row) => ({
      id: String(row.id),
      name: maskPersonName(typeof row.full_name === 'string' ? row.full_name : null),
      plan: String(row.grant_plan),
      source: String(row.grant_source),
      expiresAt: toIso(row.grant_expires_at),
    })),
    promotions: promotions.rows.map((row) => ({
      id: String(row.id),
      plan: String(row.plan),
      source: String(row.source),
      audience: String(row.audience),
      expiresAt: toIso(row.expires_at) ?? '',
      userCount: Number(row.user_count ?? 0),
    })),
  };
}
