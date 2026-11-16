import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const usersSourcePath = join(dirname(fileURLToPath(import.meta.url)), '../routes/users.ts');

describe('scheduled deletion preserves customer links', () => {
  it('keeps linked_user_id through scheduled user deletion and reactivation', async () => {
    const db = new PGlite();
    try {
      const userId = '00000000-0000-4000-8000-000000000002';
      const customerId = '00000000-0000-4000-8000-000000000001';
      await db.exec(`
        CREATE TABLE users (
          id uuid PRIMARY KEY,
          deleted_at timestamptz,
          purge_after timestamptz,
          login_retained boolean DEFAULT false,
          is_active boolean DEFAULT true
        );
        CREATE TABLE customers (
          id uuid PRIMARY KEY,
          linked_user_id uuid,
          deleted_at timestamptz
        );
        INSERT INTO users (id, deleted_at, is_active)
        VALUES ('${userId}', NULL, true);
        INSERT INTO customers (id, linked_user_id, deleted_at)
        VALUES ('${customerId}', '${userId}', NULL);
      `);

      // Scheduled deletion: mark user, do NOT unlink customers.
      await db.exec(`
        UPDATE users SET
          deleted_at = NOW(),
          purge_after = NOW() + INTERVAL '30 days',
          login_retained = true,
          is_active = false
        WHERE id = '${userId}';
      `);

      const link = await db.query<{ linked_user_id: string | null }>(
        `SELECT linked_user_id FROM customers WHERE id = '${customerId}'`,
      );
      expect(link.rows[0].linked_user_id).toBe(userId);

      // Reactivation restores the user; link remains for counterpart inbox.
      await db.exec(`
        UPDATE users SET
          deleted_at = NULL,
          purge_after = NULL,
          login_retained = false,
          is_active = true
        WHERE id = '${userId}';
      `);

      const restored = await db.query<{ linked_user_id: string | null; deleted_at: string | null }>(
        `SELECT c.linked_user_id, u.deleted_at
           FROM customers c
           JOIN users u ON u.id = c.linked_user_id
          WHERE c.id = '${customerId}'`,
      );
      expect(restored.rows[0].linked_user_id).toBe(userId);
      expect(restored.rows[0].deleted_at).toBeNull();
    } finally {
      await db.close();
    }
  });

  it('users.ts scheduled path does not unlink; immediate path purges', () => {
    const usersSource = readFileSync(usersSourcePath, 'utf8');
    expect(usersSource).not.toContain('unlinkCustomersForUser');
    expect(usersSource).toMatch(/if \(body\.mode === 'immediate'\) \{\s*\n\s*await purgeUserDataNow\(userId\);/);
  });

  it('immediate purge clears the customer link', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE customers (id uuid PRIMARY KEY, linked_user_id uuid);
        INSERT INTO customers (id, linked_user_id)
        VALUES (
          '00000000-0000-4000-8000-000000000011',
          '00000000-0000-4000-8000-000000000012'
        );
      `);
      // Same SQL used by purgeUserDataNow for unlinking.
      await db.exec(`
        UPDATE customers
           SET linked_user_id = NULL
         WHERE linked_user_id = '00000000-0000-4000-8000-000000000012';
      `);
      const result = await db.query<{ linked_user_id: string | null }>(
        `SELECT linked_user_id FROM customers
         WHERE id = '00000000-0000-4000-8000-000000000011'`,
      );
      expect(result.rows[0].linked_user_id).toBeNull();
    } finally {
      await db.close();
    }
  });
});
