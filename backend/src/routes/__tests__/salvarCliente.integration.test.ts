import './salvarClienteTestEnv.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { errorHandler } from '../../middleware/errorHandler.js';
import pool, { query } from '../../config/database.js';
import { signToken } from '../../utils/jwt.js';
import customersRouter from '../customers.js';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55440' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55440.');
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const OWNER = '11111111-1111-4111-8111-111111111111';

let pgServer: PGLiteSocketServer;
let db: PGlite;
let httpServer: Server;
let baseUrl: string;
let token: string;

function splitSql(source: string): string[] {
  const stripped = source.replace(/--.*$/gm, '');
  const parts: string[] = [];
  let buf = '';
  let dollar = false;
  for (let i = 0; i < stripped.length; i += 1) {
    if (stripped.startsWith('$$', i)) {
      dollar = !dollar;
      buf += '$$';
      i += 1;
      continue;
    }
    const ch = stripped[i];
    buf += ch;
    if (!dollar && ch === ';') {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function adapt(source: string): string {
  return source
    .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '')
    .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
}

async function applySql(source: string) {
  for (const statement of splitSql(source)) {
    try {
      await query(statement);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message}\nSQL: ${statement.slice(0, 240)}`);
    }
  }
}

async function applyFile(filename: string) {
  await applySql(adapt(readFileSync(join(migrationsDir, filename), 'utf8')));
}

async function explain(sql: string, params: unknown[] = []) {
  try {
    const result = await query(`EXPLAIN ${sql}`, params);
    return result.rows.map((row) => String(row['QUERY PLAN'] ?? JSON.stringify(row)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [`EXPLAIN indisponível neste banco: ${message}`, `SQL: ${sql}`];
  }
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55440, host: '127.0.0.1' });
  await pgServer.start();

  const where = await query(`SELECT current_database() AS name, inet_server_port() AS port`);
  if (where.rows[0]?.name === 'fiado_pro') {
    throw new Error('O teste conectou no banco de produção e foi interrompido.');
  }

  await query(`
    CREATE OR REPLACE FUNCTION update_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await query(`
    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid
    LANGUAGE sql VOLATILE AS $$ SELECT gen_random_uuid(); $$
  `);
  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      phone VARCHAR(20),
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      deleted_at TIMESTAMPTZ,
      purge_completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await applyFile('002_server_sync.sql');
  await applyFile('003_vinculo_aprovacao.sql');
  await applyFile('006_billing.sql');
  await applyFile('013_plan_model.sql');

  await query(
    `INSERT INTO users (id, email, full_name, phone, role, is_active)
     VALUES ($1, $2, 'Lojista de teste', '11888880000', 'user', TRUE)`,
    [OWNER, 'lojista-medida@example.test'],
  );
  await query(
    `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
     VALUES ($1, 'PRO', 'active', NOW() + INTERVAL '30 days')`,
    [OWNER],
  );

  for (let i = 1; i <= 20; i += 1) {
    const id = `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`;
    await query(
      `INSERT INTO customers (id, owner_user_id, name, phone, email)
       VALUES ($1, $2, $3, $4, NULL)`,
      [id, OWNER, `Cliente ${i}`, `1199000${String(i).padStart(4, '0')}`],
    );
    await query(
      `INSERT INTO transactions (customer_id, owner_user_id, type, status, amount, description)
       VALUES ($1, $2, 'DEBT', 'PENDING', 10, 'fiado'),
              ($1, $2, 'PAYMENT', 'CONFIRMED', 5, 'pagamento')`,
      [id, OWNER],
    );
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/customers', customersRouter);
  app.use(errorHandler);
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  token = signToken({ sub: OWNER, email: 'lojista-medida@example.test' });
}, 60000);

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

describe('medição do POST /api/customers com 20 clientes', () => {
  it('mede o tempo do POST e o plano das consultas', async () => {
    const before = await query(
      `SELECT COUNT(*)::int AS total FROM customers WHERE owner_user_id = $1 AND deleted_at IS NULL`,
      [OWNER],
    );
    expect(before.rows[0].total).toBe(20);
    expect(process.env.DB_NAME).toBe('postgres');

    const samples: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const id = randomUUID();
      const started = performance.now();
      const res = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `fiado_token=${token}`,
        },
        body: JSON.stringify({
          id,
          name: `Cliente medido ${i + 1}`,
          phone: `1197100000${i}`,
          email: null,
        }),
      });
      const elapsed = performance.now() - started;
      const body = (await res.json()) as { success?: boolean; error?: { message?: string } };
      samples.push(Math.round(elapsed));
      expect(res.status, JSON.stringify(body)).toBe(201);
      expect(body.success).toBe(true);
      await query(`DELETE FROM customers WHERE id = $1`, [id]);
      const again = await query(
        `SELECT COUNT(*)::int AS total FROM customers WHERE owner_user_id = $1 AND deleted_at IS NULL`,
        [OWNER],
      );
      expect(again.rows[0].total).toBe(20);
    }

    const linkSql = `UPDATE customers c SET linked_user_id = u.id
       FROM users u
      WHERE c.id = $1
        AND c.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND u.is_active = TRUE
        AND u.id <> c.owner_user_id
        AND (
              (c.email IS NOT NULL AND c.email <> '' AND lower(u.email) = lower(c.email))
           OR (fn_norm_phone(c.phone) <> '' AND fn_norm_phone(u.phone) = fn_norm_phone(c.phone))
        )`;
    const listSql = `SELECT id,
              (SELECT COUNT(*) FROM transactions t
                WHERE t.customer_id = customers.id AND t.status = 'PENDING') AS pending_count
         FROM customers
        WHERE owner_user_id = $1 AND deleted_at IS NULL
        ORDER BY name ASC`;
    const customerId = '22222222-2222-4222-8222-000000000001';
    const linkPlan = await explain(linkSql, [customerId]);
    const listPlan = await explain(listSql, [OWNER]);

    const listStarted = performance.now();
    const listed = await query(listSql, [OWNER]);
    const listMs = Math.round(performance.now() - listStarted);

    const report = {
      postMs: samples,
      listMs,
      listRows: listed.rowCount,
      linkPlan,
      listPlan,
    };
    console.log(`MEDICAO_SALVAR ${JSON.stringify(report)}`);
    expect(samples, `POST ms: ${samples.join(', ')}`).toHaveLength(3);
    expect(samples.every((ms) => ms < 1000)).toBe(true);
    expect(listed.rowCount).toBe(20);
    expect(linkPlan.join('\n')).toContain('Index Scan using customers_pkey');
    expect(listPlan.join('\n')).toContain('idx_customers_owner');
  }, 30000);
});
