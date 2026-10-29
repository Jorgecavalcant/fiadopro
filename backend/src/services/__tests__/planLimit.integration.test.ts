import './planLimitTestEnv.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { errorHandler } from '../../middleware/errorHandler.js';
import pool, { query } from '../../config/database.js';
import { signToken } from '../../utils/jwt.js';
import customersRouter from '../../routes/customers.js';
import transactionsRouter from '../../routes/transactions.js';

if (process.env.DB_PORT !== '55434' || process.env.DB_NAME === 'fiado_pro') {
  throw new Error('Teste recusou o banco: só a porta 55434, nunca produção.');
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
let pgServer: PGLiteSocketServer;
let db: PGlite;
let httpServer: Server;
let baseUrl: string;

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
    buf += stripped[i];
    if (!dollar && stripped[i] === ';') {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

async function applyBilling() {
  const source = readFileSync(join(migrationsDir, '006_billing.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
    .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
  for (const statement of splitSql(source)) await query(statement);
  for (const file of ['008_billing_cancel.sql', '013_plan_model.sql']) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    for (const statement of splitSql(sql)) await query(statement);
  }
}

async function createCustomersSchema() {
  await query(
    `CREATE FUNCTION uuid_generate_v4() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql`,
  );
  await query(
    `CREATE FUNCTION fn_norm_phone(p text) RETURNS text AS $$ SELECT regexp_replace(COALESCE(p, ''), '\\D', '', 'g') $$ LANGUAGE sql IMMUTABLE`,
  );
  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      deleted_at TIMESTAMPTZ
    )
  `);
  await query(`
    CREATE TABLE customers (
      id UUID PRIMARY KEY,
      owner_user_id UUID NOT NULL REFERENCES users(id),
      linked_user_id UUID,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      pix_key TEXT,
      trusted BOOLEAN NOT NULL DEFAULT FALSE,
      overpayment_strategy TEXT NOT NULL DEFAULT 'RETURN',
      notes JSONB NOT NULL DEFAULT '[]',
      score INTEGER,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createTransactionsTable() {
  await query(`
    CREATE TABLE transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID,
      owner_user_id UUID,
      created_by_user_id UUID,
      type TEXT,
      status TEXT,
      amount NUMERIC,
      description TEXT,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      due_date TIMESTAMPTZ,
      payment_method TEXT,
      attachment JSONB,
      installment_number INT,
      total_installments INT,
      installment_group_id UUID,
      interest_rate NUMERIC,
      applies_to_transaction_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55434, host: '127.0.0.1' });
  await pgServer.start();
  const where = await query(`SELECT current_database() AS name`);
  if (where.rows[0]?.name === 'fiado_pro') throw new Error('Banco de produção.');

  await createCustomersSchema();
  await createTransactionsTable();
  await applyBilling();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/customers', customersRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use(errorHandler);
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

async function userOf(role: 'user' | 'admin' = 'user'): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO users (id, email, full_name, role, is_active) VALUES ($1, $2, 'Pessoa de teste', $3, TRUE)`,
    [id, `${id}@example.test`, role],
  );
  return id;
}

function cookie(id: string) {
  return { Cookie: `fiado_token=${signToken({ sub: id, email: `${id}@example.test` })}` };
}

describe('limite de plano no servidor', () => {
  it('o 21º cliente no Free é recusado', async () => {
    const userId = await userOf();
    for (let n = 0; n < 20; n += 1) {
      await query(
        `INSERT INTO customers (id, owner_user_id, name, phone) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, `Cliente ${n}`, `1190000${String(n).padStart(4, '0')}`],
      );
    }
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookie(userId) },
      body: JSON.stringify({ name: 'Cliente extra', phone: '11999990000' }),
    });
    const body = (await res.json()) as { error?: { code?: string } };
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('PLAN_LIMIT');
  });

  it('relatório de 7 meses no Free é recusado e 6 meses passa', async () => {
    const userId = await userOf();
    const tooWide = await fetch(`${baseUrl}/api/transactions?months=7`, {
      headers: cookie(userId),
    });
    const tooWideBody = (await tooWide.json()) as { error?: { code?: string } };
    expect(tooWide.status).toBe(403);
    expect(tooWideBody.error?.code).toBe('PLAN_LIMIT');

    const ok = await fetch(`${baseUrl}/api/transactions?months=6`, { headers: cookie(userId) });
    expect(ok.status).toBe(200);
  });

  it('quem está no Pro passa do vigésimo cliente', async () => {
    const userId = await userOf();
    await query(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
       VALUES ($1, 'PRO', 'active', NOW() + INTERVAL '10 days')`,
      [userId],
    );
    for (let n = 0; n < 20; n += 1) {
      await query(
        `INSERT INTO customers (id, owner_user_id, name, phone) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, `Cliente ${n}`, `1180000${String(n).padStart(4, '0')}`],
      );
    }
    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookie(userId) },
      body: JSON.stringify({ name: 'Cliente vinte e um', phone: '11888880000' }),
    });
    expect(res.status).toBe(201);
  });
});
