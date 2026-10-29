import { query } from '../config/database.js';

export const LAST_ADMIN_DELETE_MESSAGE =
  'Você é o único administrador ativo. Crie outro administrador antes de encerrar esta conta.';

export const LAST_ADMIN_BLOCK_MESSAGE =
  'Não é possível bloquear o último administrador ativo.';

/**
 * Verdadeiro quando desativar ou encerrar este usuário deixaria a plataforma
 * sem nenhum administrador ativo.
 */
export async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const result = await query(
    `SELECT
        (role = 'admin' AND is_active IS TRUE AND deleted_at IS NULL) AS is_active_admin,
        (SELECT COUNT(*)::int FROM users
          WHERE role = 'admin' AND deleted_at IS NULL AND is_active IS TRUE) AS active_admins
       FROM users
      WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0] as { is_active_admin?: boolean; active_admins?: number } | undefined;
  if (!row?.is_active_admin) return false;
  return Number(row.active_admins) <= 1;
}
