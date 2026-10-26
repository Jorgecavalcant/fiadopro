import { query } from '../config/database.js';

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

export async function purgeExpiredAccounts(): Promise<void> {
  const result = await query(
    `SELECT id
       FROM users
      WHERE purge_after <= NOW()
        AND purge_completed_at IS NULL
        AND deleted_at IS NOT NULL`,
  );

  for (const row of result.rows as Array<{ id: string }>) {
    const userId = row.id;

    await query(
      `DELETE FROM payments
        WHERE debt_id IN (SELECT id FROM debts WHERE user_id = $1)`,
      [userId],
    );
    await query('DELETE FROM debts WHERE user_id = $1', [userId]);
    await query('DELETE FROM transactions WHERE owner_user_id = $1', [userId]);
    await query('DELETE FROM customers WHERE owner_user_id = $1', [userId]);
    await query('DELETE FROM ai_interactions WHERE user_id = $1', [userId]);
    await query(
      `UPDATE users
          SET purge_completed_at = NOW()
        WHERE id = $1
          AND purge_after <= NOW()
          AND purge_completed_at IS NULL`,
      [userId],
    );
  }
}

export function startAccountPurgeScheduler(): ReturnType<typeof setInterval> {
  void purgeExpiredAccounts().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  });

  const timer = setInterval(() => {
    void purgeExpiredAccounts().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
    });
  }, 60 * 60 * 1000);

  timer.unref?.();
  return timer;
}
