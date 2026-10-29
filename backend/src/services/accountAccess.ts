import { query } from '../config/database.js';

export const ACCOUNT_CLOSED_CONFIRM_MESSAGE =
  'Esta conta foi encerrada e pode voltar. Confirme para recuperar a mesma conta.';

export const ACCOUNT_CLOSED_TX_MESSAGE =
  'Esta conta está encerrada. Dá para consultar o histórico, não para fazer um lançamento novo.';

export const LEGAL_HOLD_REACTIVATE_MESSAGE =
  'Esta conta está sob bloqueio judicial. Ela saiu da fila de exclusão, mas continua bloqueada até um administrador liberar.';

export const OWN_PHONE_MESSAGE = 'Esse telefone é o seu.';
export const OWN_EMAIL_MESSAGE = 'Esse e-mail é o seu.';

type Sql = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type ClosedAccountRow = {
  id: string;
  email: string;
  full_name: string | null;
  password_hash: string | null;
  is_active: boolean;
  role: string;
  deleted_at: Date | string | null;
  purge_completed_at: Date | string | null;
  purge_after: Date | string | null;
  login_retained: boolean;
  legal_hold: boolean;
};

const ACCOUNT_COLUMNS = `id, email, full_name, password_hash, is_active, role,
  deleted_at, purge_completed_at, purge_after, login_retained, legal_hold`;

export function isReactivatableAccount(row: {
  email?: string | null;
  deleted_at?: unknown;
  purge_completed_at?: unknown;
  purge_after?: unknown;
  login_retained?: unknown;
} | null | undefined): boolean {
  if (!row?.deleted_at || row.purge_completed_at) return false;
  if (row.login_retained !== true) return false;
  if (/^deleted_.+@removed\.invalid$/i.test(String(row.email ?? ''))) return false;
  const purge = row.purge_after ? new Date(row.purge_after as string).getTime() : 0;
  return Number.isFinite(purge) && purge > Date.now();
}

export async function findUserByEmail(email: string): Promise<ClosedAccountRow | null> {
  const result = await query(`SELECT ${ACCOUNT_COLUMNS} FROM users WHERE email = $1`, [email]);
  return (result.rows[0] as ClosedAccountRow | undefined) ?? null;
}

export async function reactivateAccount(userId: string, googleId: string | null = null) {
  const result = await query(
    `UPDATE users SET
        deleted_at = NULL,
        purge_after = NULL,
        login_retained = false,
        is_active = CASE WHEN legal_hold IS TRUE THEN false ELSE true END,
        google_id = COALESCE($2, google_id),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NOT NULL
        AND purge_completed_at IS NULL
        AND purge_after > NOW()
        AND login_retained IS TRUE
        AND email NOT LIKE 'deleted_%@removed.invalid'
      RETURNING id, email, full_name, role,
        (password_hash IS NOT NULL) AS has_password,
        legal_hold, is_active`,
    [userId, googleId],
  );
  return result.rows[0] ?? null;
}

export async function partyAccountClosed(ids: Array<string | null | undefined>): Promise<boolean> {
  const list = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (list.length === 0) return false;
  const result = await query(
    `SELECT 1 FROM users
      WHERE id = ANY($1::uuid[])
        AND deleted_at IS NOT NULL
        AND purge_completed_at IS NULL
      LIMIT 1`,
    [list],
  );
  return result.rows.length > 0;
}

const REACTIVATABLE_SQL = `deleted_at IS NOT NULL
  AND purge_completed_at IS NULL
  AND purge_after > NOW()
  AND login_retained IS TRUE
  AND email NOT LIKE 'deleted_%@removed.invalid'`;

export async function applyAdminReactivation(sql: Sql, userId: string) {
  const found = await sql(
    `SELECT legal_hold IS TRUE AS legal_hold,
            (${REACTIVATABLE_SQL}) AS reactivatable
       FROM users
      WHERE id = $1`,
    [userId],
  );
  const current = found.rows[0];
  if (!current) return { missing: true as const };
  if (current.reactivatable !== true) return { closed: false as const };

  const saved = await sql(
    `UPDATE users SET
        deleted_at = NULL,
        purge_after = NULL,
        login_retained = false,
        is_active = CASE WHEN legal_hold IS TRUE THEN false ELSE true END,
        updated_at = NOW()
      WHERE id = $1
        AND ${REACTIVATABLE_SQL}
      RETURNING id, legal_hold, is_active`,
    [userId],
  );
  const user = saved.rows[0];
  if (!user) return { closed: false as const };
  return {
    user: {
      id: String(user.id),
      is_active: user.is_active === true,
      legal_hold: user.legal_hold === true,
    },
    beforeHold: current.legal_hold === true,
  };
}

export function maskPersonName(fullName: string | null | undefined): string {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '***';
  return parts.map((part) => `${Array.from(part)[0]}***`).join(' ');
}

export function closedAccountStatus(legalHold: boolean): 'Ordem judicial' | 'Aguardando exclusão' {
  return legalHold ? 'Ordem judicial' : 'Aguardando exclusão';
}
