import './planModelTestEnv.js';
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
import { getUserPlan } from '../plans.js';
import { signToken } from '../../utils/jwt.js';
import billingRouter from '../../routes/billing.js';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55433' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55433.');
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

async function applySql(source: string) {
  for (const statement of splitSql(source)) {
    await query(statement);
  }
}

async function applySqlFile(filename: string) {
  await applySql(readFileSync(join(migrationsDir, filename), 'utf8'));
}

/** A migration 006 pede uuid-ossp. O banco deste teste não traz essa extensão. */
async function applyBillingBase() {
  const source = readFileSync(join(migrationsDir, '006_billing.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
    .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
  await applySql(source);
}

async function insertUser(role: 'user' | 'admin' = 'user'): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO users (id, email, full_name, role, is_active)
     VALUES ($1, $2, 'Pessoa de teste', $3, TRUE)`,
    [id, `${id}@example.test`, role],
  );
  return id;
}

async function paidPro(userId: string, when: 'future' | 'past') {
  const end = when === 'future' ? `NOW() + INTERVAL '10 days'` : `NOW() - INTERVAL '1 day'`;
  await query(
    `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
     VALUES ($1, 'PRO', 'active', ${end})`,
    [userId],
  );
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55433, host: '127.0.0.1' });
  await pgServer.start();

  const where = await query(`SELECT current_database() AS name`);
  if (where.rows[0]?.name === 'fiado_pro') {
    throw new Error('O teste conectou no banco de produção e foi interrompido.');
  }

  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      password_hash TEXT,
      cpf TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await applyBillingBase();
  await applySqlFile('008_billing_cancel.sql');
  await applySqlFile('013_plan_model.sql');
  await applySqlFile('013_plan_model.sql');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/billing', billingRouter);
  app.use(errorHandler);
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

describe('modelo de plano no banco local', () => {
  it('pagamento vigente libera Pro e o status cobra 30, sem o 97', async () => {
    const userId = await insertUser();
    await paidPro(userId, 'future');
    await expect(getUserPlan(userId)).resolves.toBe('PRO');

    const token = signToken({ sub: userId, email: `${userId}@example.test` });
    const res = await fetch(`${baseUrl}/api/billing/status`, {
      headers: { Cookie: `fiado_token=${token}` },
    });
    const body = (await res.json()) as {
      plan: string;
      prices: { free: number; pro: number };
      adPolicy: string;
      maxReportMonths: number;
    };
    expect(res.status).toBe(200);
    expect(body.plan).toBe('PRO');
    expect(body.prices).toEqual({ free: 0, pro: 30 });
    expect(body.adPolicy).toBe('local_sponsor');
    expect(body.maxReportMonths).toBe(12);
    expect(body.prices).not.toHaveProperty('enterprise');
  });

  it('pagamento vencido bloqueia', async () => {
    const userId = await insertUser();
    await paidPro(userId, 'past');
    await expect(getUserPlan(userId)).resolves.toBe('FREE');
  });

  it('Enterprise cabe no banco e libera quando está vigente', async () => {
    const userId = await insertUser();
    await query(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
       VALUES ($1, 'ENTERPRISE', 'active', NOW() + INTERVAL '10 days')`,
      [userId],
    );
    await expect(getUserPlan(userId)).resolves.toBe('ENTERPRISE');
  });

  it('cortesia vencida volta ao Pro pago; teste vencido volta ao Free', async () => {
    const courtesy = await insertUser();
    await paidPro(courtesy, 'future');
    await query(
      `UPDATE subscriptions
          SET grant_plan = 'ENTERPRISE',
              grant_source = 'cortesia',
              grant_expires_at = NOW() - INTERVAL '1 day'
        WHERE user_id = $1`,
      [courtesy],
    );
    await expect(getUserPlan(courtesy)).resolves.toBe('PRO');

    const trial = await insertUser();
    await query(
      `INSERT INTO subscriptions (user_id, plan, grant_plan, grant_source, grant_expires_at)
       VALUES ($1, 'FREE', 'PRO', 'trial', NOW() - INTERVAL '1 day')`,
      [trial],
    );
    await query(`UPDATE users SET trial_used_at = NOW() WHERE id = $1`, [trial]);
    await expect(getUserPlan(trial)).resolves.toBe('FREE');
  });

  it('promoção da base inteira sobe e, ao vencer, cada um volta ao plano devido', async () => {
    const userId = await insertUser();
    const promo = await query(
      `INSERT INTO plan_promotions (plan, source, expires_at, audience)
       VALUES ('PRO', 'promocao', NOW() + INTERVAL '3 days', 'all')
       RETURNING id`,
    );
    await expect(getUserPlan(userId)).resolves.toBe('PRO');

    await query(`UPDATE plan_promotions SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [
      promo.rows[0].id,
    ]);
    await expect(getUserPlan(userId)).resolves.toBe('FREE');
  });

  it('promoção de lista só vale para quem foi escolhido', async () => {
    const chosen = await insertUser();
    const other = await insertUser();
    const promo = await query(
      `INSERT INTO plan_promotions (plan, source, expires_at, audience)
       VALUES ('ENTERPRISE', 'promocao', NOW() + INTERVAL '2 days', 'selected')
       RETURNING id`,
    );
    await query(`INSERT INTO plan_promotion_users (promotion_id, user_id) VALUES ($1, $2)`, [
      promo.rows[0].id,
      chosen,
    ]);
    await expect(getUserPlan(chosen)).resolves.toBe('ENTERPRISE');
    await expect(getUserPlan(other)).resolves.toBe('FREE');
  });

  it('o down manual não apaga a pessoa', async () => {
    const userId = await insertUser();
    await paidPro(userId, 'future');
    await query(`UPDATE subscriptions SET plan = 'PRO' WHERE plan = 'ENTERPRISE'`);
    await applySqlFile('down/013_plan_model.sql');

    const still = await query(`SELECT id FROM users WHERE id = $1`, [userId]);
    expect(still.rows).toHaveLength(1);
    const columns = await query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'grant_plan'`,
    );
    expect(columns.rows).toHaveLength(0);

    await expect(
      query(`UPDATE subscriptions SET plan = 'ENTERPRISE' WHERE user_id = $1`, [userId]),
    ).rejects.toThrow(/check/i);
  });
});
