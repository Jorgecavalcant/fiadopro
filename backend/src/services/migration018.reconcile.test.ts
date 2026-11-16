import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations/018_vinculo_admin_hardening.sql',
);

describe('migration 018_vinculo_admin_hardening', () => {
  it('reconciles duplicate emails and phones, creates indexes, and is repeatable', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE OR REPLACE FUNCTION uuid_generate_v4()
        RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;

        CREATE TABLE users (id uuid PRIMARY KEY);
        CREATE TABLE customers (
          id uuid PRIMARY KEY,
          owner_user_id uuid,
          email text,
          phone text,
          deleted_at timestamptz,
          created_at timestamptz NOT NULL,
          linked_user_id uuid,
          name text
        );
        CREATE OR REPLACE FUNCTION fn_norm_phone(value text)
        RETURNS text LANGUAGE sql IMMUTABLE AS $$
          SELECT regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g')
        $$;

        CREATE TABLE ai_interactions (user_id uuid);
        CREATE TABLE password_reset_tokens (user_id uuid);
        CREATE TABLE transaction_events (actor_user_id uuid);
        CREATE TABLE transactions (applies_to_transaction_id uuid);
        CREATE TABLE email_confirmation_tokens (user_id uuid);
        CREATE TABLE plan_promotion_users (user_id uuid);
        CREATE TABLE sponsor_contracts (sponsor_id uuid, renovado_de uuid, created_by uuid);
        CREATE TABLE sponsor_creatives (media_id uuid);
      `);

      const migration = readFileSync(migrationPath, 'utf8');
      const ownerId = '00000000-0000-4000-8000-000000000001';
      await db.query('INSERT INTO users (id) VALUES ($1)', [ownerId]);

      // Scenario A: two ACTIVE customers collide on email after trim/case.
      await db.query(
        `INSERT INTO customers (id, owner_user_id, email, phone, deleted_at, created_at, name)
         VALUES
         ('00000000-0000-4000-8000-000000000011', $1, ' Alice@example.test ', '11999990001', NULL, '2024-01-01T00:00:00Z', 'email keeper'),
         ('00000000-0000-4000-8000-000000000012', $1, 'alice@EXAMPLE.test', '11999990002', NULL, '2024-01-02T00:00:00Z', 'email duplicate')`,
        [ownerId],
      );

      // Scenario B: same normalized phone, distinct emails (no email collision).
      await db.query(
        `INSERT INTO customers (id, owner_user_id, email, phone, deleted_at, created_at, name)
         VALUES
         ('00000000-0000-4000-8000-000000000021', $1, 'phone-one@example.test', '11999990003', NULL, '2024-01-01T00:00:00Z', 'phone keeper'),
         ('00000000-0000-4000-8000-000000000022', $1, 'phone-two@example.test', '(11) 99999-0003', NULL, '2024-01-02T00:00:00Z', 'phone duplicate')`,
        [ownerId],
      );

      await db.exec(migration);
      await db.exec(migration);

      const emailQueue = await db.query(
        `SELECT reason FROM link_review_queue WHERE reason = 'duplicate_email_reconcile'`,
      );
      expect(emailQueue.rows).toHaveLength(1);

      const emailRows = await db.query(
        `SELECT id, deleted_at IS NULL AS active FROM customers
         WHERE id IN ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012')
         ORDER BY id`,
      );
      expect(emailRows.rows).toEqual([
        { id: '00000000-0000-4000-8000-000000000011', active: true },
        { id: '00000000-0000-4000-8000-000000000012', active: false },
      ]);

      const phoneQueue = await db.query(
        `SELECT reason FROM link_review_queue WHERE reason = 'duplicate_phone_reconcile'`,
      );
      expect(phoneQueue.rows).toHaveLength(1);

      const phoneRows = await db.query(
        `SELECT id, deleted_at IS NULL AS active FROM customers
         WHERE id IN ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022')
         ORDER BY id`,
      );
      expect(phoneRows.rows).toEqual([
        { id: '00000000-0000-4000-8000-000000000021', active: true },
        { id: '00000000-0000-4000-8000-000000000022', active: false },
      ]);

      const total = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM customers');
      expect(total.rows[0].count).toBe(4);

      const indexes = await db.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname IN ('uq_customers_owner_email_active', 'uq_customers_owner_phone_active')`,
      );
      expect(indexes.rows.map((row) => row.indexname).sort()).toEqual([
        'uq_customers_owner_email_active',
        'uq_customers_owner_phone_active',
      ]);
    } finally {
      await db.close();
    }
  });
});
