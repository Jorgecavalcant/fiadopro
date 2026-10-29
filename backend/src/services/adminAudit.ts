import { getClient, query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export const BLOCK_REASONS = ['judicial', 'fraude', 'pedido_do_usuario', 'outro'] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

const NOTE_MIN = 8;
const RETENTION = `NOW() + INTERVAL '5 years'`;
const CPF_OR_CNPJ = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

type Sql = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type UserPatch = {
  full_name?: string;
  phone?: string | null;
  is_active?: boolean;
  block_reason?: BlockReason;
  block_note?: string;
  unblock_note?: string;
};

type UserRow = {
  id: string;
  is_active: boolean;
  block_reason: string | null;
  legal_hold: boolean;
  deleted_at: string | null;
};

function noteProblem(note: string | undefined, required: boolean): string | null {
  const text = note?.trim() ?? '';
  if (required && text.length < NOTE_MIN) {
    return 'Escreva uma observação com pelo menos 8 caracteres. Não cole CPF, senha ou Pix.';
  }
  if (text && CPF_OR_CNPJ.test(text)) {
    return 'Não coloque CPF ou CNPJ na observação.';
  }
  return null;
}

export function validateBlock(reason: string | undefined, note: string | undefined): string | null {
  if (!reason || !BLOCK_REASONS.includes(reason as BlockReason)) {
    return 'Informe o motivo do bloqueio.';
  }
  return noteProblem(note, reason === 'judicial' || reason === 'outro');
}

export function validateRequiredNote(note: string | undefined): string | null {
  return noteProblem(note, true);
}

export async function withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function insertAuditEntry(
  sql: Sql,
  entry: {
    adminId: string;
    action: string;
    targetUserId: string | null;
    reason: string | null;
    note: string | null;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
    keepWhileOrderStands: boolean;
  },
) {
  await sql(
    `INSERT INTO admin_audit_log
       (admin_id, action, target_user_id, reason, note, before_state, after_state, retain_until)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, ${entry.keepWhileOrderStands ? 'NULL' : RETENTION})`,
    [
      entry.adminId,
      entry.action,
      entry.targetUserId,
      entry.reason,
      entry.note,
      JSON.stringify(entry.beforeState),
      JSON.stringify(entry.afterState),
    ],
  );
}

function accessState(row: UserRow) {
  return {
    is_active: row.is_active,
    legal_hold: row.legal_hold === true,
    block_reason: row.block_reason,
  };
}

const SAFE_RETURNING = `id, email, full_name, phone, avatar_url, role, is_active, created_at, updated_at,
  block_reason, block_note, legal_hold, blocked_at`;

async function applyBlock(sql: Sql, userId: string, adminId: string, reason: string, note: string | null, judicial: boolean, body: UserPatch) {
  await sql(
    `UPDATE users SET
       is_active = false,
       block_reason = $2,
       block_note = $3,
       blocked_by = $4,
       blocked_at = NOW(),
       legal_hold = $5,
       full_name = COALESCE($6, full_name),
       phone = CASE WHEN $7::boolean THEN $8 ELSE phone END,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, reason, note, adminId, judicial, body.full_name ?? null, body.phone !== undefined, body.phone ?? null],
  );
}

async function applyUnblock(sql: Sql, userId: string, hadHold: boolean) {
  await sql(
    `UPDATE users SET
       is_active = CASE WHEN deleted_at IS NULL THEN true ELSE false END,
       block_reason = NULL,
       block_note = NULL,
       blocked_by = NULL,
       blocked_at = NULL,
       legal_hold = false,
       purge_after = CASE
         WHEN deleted_at IS NOT NULL AND legal_hold IS TRUE THEN NOW() + INTERVAL '30 days'
         ELSE purge_after
       END,
       updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
  if (!hadHold) return;
  await sql(
    `UPDATE admin_audit_log
        SET retain_until = ${RETENTION}
      WHERE target_user_id = $1 AND reason = 'judicial' AND retain_until IS NULL`,
    [userId],
  );
}

async function applyProfile(sql: Sql, userId: string, body: UserPatch) {
  await sql(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone = CASE WHEN $3::boolean THEN $4 ELSE phone END,
       updated_at = NOW()
     WHERE id = $1`,
    [userId, body.full_name ?? null, body.phone !== undefined, body.phone ?? null],
  );
}

export async function updateAdminUser(adminId: string, userId: string, body: UserPatch) {
  if (body.is_active === false) {
    const message = validateBlock(body.block_reason, body.block_note);
    if (message) return { error: new ApiError(400, message, 'VALIDATION_ERROR') };
  }
  if (body.is_active === true) {
    const message = noteProblem(body.unblock_note, true);
    if (message) return { error: new ApiError(400, message, 'VALIDATION_ERROR') };
  }

  return withTransaction(async (sql) => {
    const found = await sql(
      `SELECT id, is_active, block_reason, legal_hold, deleted_at
         FROM users
        WHERE id = $1 AND (deleted_at IS NULL OR legal_hold IS TRUE)`,
      [userId],
    );
    const current = found.rows[0] as UserRow | undefined;
    if (!current) return { error: new ApiError(404, 'Usuário não encontrado', 'USER_NOT_FOUND') };
    if (body.is_active === false && current.is_active === false) {
      return { error: new ApiError(409, 'Este usuário já está bloqueado.', 'ALREADY_BLOCKED') };
    }

    const before = accessState(current);
    const blocking = body.is_active === false;
    const unblocking = body.is_active === true;
    const reason = blocking ? (body.block_reason as string) : null;
    const judicial = reason === 'judicial';
    const note = (blocking ? body.block_note : body.unblock_note)?.trim() || null;

    if (blocking) await applyBlock(sql, userId, adminId, reason as string, note, judicial, body);
    else if (unblocking) await applyUnblock(sql, userId, current.legal_hold === true);
    else await applyProfile(sql, userId, body);

    const afterRow = await sql(
      `SELECT is_active, block_reason, legal_hold, deleted_at FROM users WHERE id = $1`,
      [userId],
    );
    const after = accessState(afterRow.rows[0] as UserRow);
    const fields = [
      body.full_name !== undefined ? 'full_name' : null,
      body.phone !== undefined ? 'phone' : null,
    ].filter(Boolean);

    await insertAuditEntry(sql, {
      adminId,
      action: blocking ? 'user.block' : unblocking ? 'user.unblock' : 'user.update',
      targetUserId: userId,
      reason: blocking ? reason : current.block_reason,
      note,
      beforeState: before,
      afterState: { ...after, fields },
      keepWhileOrderStands: judicial,
    });

    const saved = await sql(`SELECT ${SAFE_RETURNING} FROM users WHERE id = $1`, [userId]);
    return { user: saved.rows[0] };
  });
}

export async function listAdminAudit(filters: {
  action?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filters.action) {
    params.push(filters.action);
    where.push(`l.action = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`l.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`l.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(
    `SELECT COUNT(*)::int AS total FROM admin_audit_log l ${clause}`,
    params,
  );
  const offset = (filters.page - 1) * filters.limit;
  const listParams = [...params, filters.limit, offset];
  const rows = await query(
    `SELECT l.id, l.created_at, l.action, l.reason, l.note, l.before_state, l.after_state,
            a.full_name AS admin_name, t.full_name AS target_name
       FROM admin_audit_log l
       LEFT JOIN users a ON a.id = l.admin_id
       LEFT JOIN users t ON t.id = l.target_user_id
       ${clause}
      ORDER BY l.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const total = count.rows[0]?.total ?? 0;
  return {
    entries: rows.rows,
    meta: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  };
}

export async function expireAdminAuditLogs(): Promise<void> {
  await query(
    `DELETE FROM admin_audit_log
      WHERE retain_until IS NOT NULL
        AND retain_until <= NOW()`,
  );
}
