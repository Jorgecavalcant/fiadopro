import { getClient, query } from '../config/database.js';
import { expireAdminAuditLogs } from './adminAudit.js';

export type AccountDeletionUser = {
  password_hash: string | null;
};

export function confirmAccountDeletion(
  user: AccountDeletionUser,
  confirmation: string,
  passwordMatches: boolean,
): string | null {
  if (user.password_hash) {
    return passwordMatches ? null : 'INVALID_PASSWORD';
  }

  return confirmation.trim() === 'CANCELAR' ? null : 'INVALID_CONFIRMATION';
}

export function confirmImmediateDeletion(
  user: AccountDeletionUser,
  confirmationWord: string,
  passwordMatches: boolean,
): string | null {
  if (confirmationWord.trim() !== 'EXCLUIR') {
    return 'INVALID_CONFIRMATION';
  }

  if (user.password_hash && !passwordMatches) {
    return 'INVALID_PASSWORD';
  }

  return null;
}

export async function unlinkCustomersForUser(userId: string): Promise<void> {
  await query(
    'UPDATE customers SET linked_user_id = NULL WHERE linked_user_id = $1',
    [userId],
  );
}

export async function purgeUserDataNow(userId: string): Promise<void> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT legal_hold FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );

    if ((result.rows as Array<{ legal_hold: boolean | null }>)[0]?.legal_hold === true) {
      await client.query('ROLLBACK');
      return;
    }

    await client.query(
      'UPDATE customers SET linked_user_id = NULL WHERE linked_user_id = $1',
      [userId],
    );

    await client.query(
      `DELETE FROM payments
        WHERE debt_id IN (SELECT id FROM debts WHERE user_id = $1)`,
      [userId],
    );
    await client.query('DELETE FROM debts WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM transactions WHERE owner_user_id = $1', [userId]);
    await client.query('DELETE FROM customers WHERE owner_user_id = $1', [userId]);
    await client.query('DELETE FROM ai_interactions WHERE user_id = $1', [userId]);
    await client.query(
      `UPDATE users
          SET purge_completed_at = NOW(),
              deleted_reason = NULL,
              full_name = 'Conta removida',
              email = 'deleted_' || id::text || '@removed.invalid',
              phone = NULL,
              avatar_url = NULL,
              google_id = NULL,
              cpf = NULL,
              pix_key = NULL,
              password_hash = NULL,
              login_retained = false,
              is_active = false
        WHERE id = $1
          AND legal_hold IS NOT TRUE`,
      [userId],
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function purgeExpiredAccounts(): Promise<void> {
  const result = await query(
    `SELECT id
       FROM users
      WHERE purge_after <= NOW()
        AND purge_completed_at IS NULL
        AND deleted_at IS NOT NULL
        AND legal_hold IS NOT TRUE`,
  );

  for (const row of result.rows as Array<{ id: string }>) {
    await purgeUserDataNow(row.id);
  }
}

async function runAccountMaintenance(): Promise<void> {
  await purgeExpiredAccounts();
  await expireAdminAuditLogs();
}

export function startAccountPurgeScheduler(): ReturnType<typeof setInterval> {
  void runAccountMaintenance().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  });

  const timer = setInterval(() => {
    void runAccountMaintenance().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
    });
  }, 60 * 60 * 1000);

  timer.unref?.();
  return timer;
}
