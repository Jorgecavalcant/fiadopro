import { query } from '../config/database.js';
import { normalizePhone } from '../utils/phone.js';

/**
 * Vínculo cliente↔usuário: um customer cujo phone/email bate com um usuário
 * ativo ganha linked_user_id. A partir daí, lançamentos contra ele exigem
 * aprovação do usuário vinculado (status PENDING).
 */

/** Tenta vincular UM customer recém-criado/editado. Retorna o linked_user_id (ou null). */
export async function linkCustomer(customerId: string): Promise<string | null> {
  const result = await query(
    `UPDATE customers c SET linked_user_id = u.id
       FROM users u
      WHERE c.id = $1
        AND c.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND u.is_active = TRUE
        AND u.id <> c.owner_user_id
        AND (
              (c.email IS NOT NULL AND c.email <> '' AND lower(u.email) = lower(c.email))
           OR (fn_norm_phone(c.phone) <> '' AND fn_norm_phone(u.phone) = fn_norm_phone(c.phone))
        )
      RETURNING c.linked_user_id`,
    [customerId]
  );
  if (result.rows[0]?.linked_user_id) return result.rows[0].linked_user_id as string;

  // Sem match: garantir que um vínculo antigo que deixou de bater seja removido
  await query(
    `UPDATE customers c SET linked_user_id = NULL
      WHERE c.id = $1 AND c.linked_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u
           WHERE u.id = c.linked_user_id
             AND u.deleted_at IS NULL AND u.is_active = TRUE
             AND ((c.email IS NOT NULL AND c.email <> '' AND lower(u.email) = lower(c.email))
               OR (fn_norm_phone(c.phone) <> '' AND fn_norm_phone(u.phone) = fn_norm_phone(c.phone)))
        )`,
    [customerId]
  );
  return null;
}

/**
 * Revincula TODOS os customers relevantes para um usuário (após registro
 * ou mudança de e-mail/telefone no perfil).
 */
export async function relinkCustomersForUser(userId: string): Promise<number> {
  // 1. Desfazer vínculos com este usuário que não batem mais
  await query(
    `UPDATE customers c SET linked_user_id = NULL
      WHERE c.linked_user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM users u
           WHERE u.id = $1 AND u.deleted_at IS NULL AND u.is_active = TRUE
             AND ((c.email IS NOT NULL AND c.email <> '' AND lower(u.email) = lower(c.email))
               OR (fn_norm_phone(c.phone) <> '' AND fn_norm_phone(u.phone) = fn_norm_phone(c.phone)))
        )`,
    [userId]
  );

  // 2. Criar vínculos novos onde o usuário agora bate
  const linked = await query(
    `UPDATE customers c SET linked_user_id = $1
       FROM users u
      WHERE u.id = $1
        AND c.deleted_at IS NULL
        AND c.linked_user_id IS NULL
        AND c.owner_user_id <> $1
        AND u.deleted_at IS NULL AND u.is_active = TRUE
        AND ((c.email IS NOT NULL AND c.email <> '' AND lower(u.email) = lower(c.email))
          OR (fn_norm_phone(c.phone) <> '' AND fn_norm_phone(u.phone) = fn_norm_phone(c.phone)))
      RETURNING c.id`,
    [userId]
  );
  return linked.rowCount ?? 0;
}

/** Bootstrap idempotente: promove o ADMIN_EMAIL a admin (chamado na subida e no registro). */
export async function ensureAdminRole(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  try {
    await query(
      `UPDATE users SET role = 'admin' WHERE lower(email) = lower($1) AND role <> 'admin'`,
      [adminEmail]
    );
  } catch (err) {
    console.error('[bootstrap] Falha ao promover ADMIN_EMAIL:', err instanceof Error ? err.message : err);
  }
}

export { normalizePhone };
