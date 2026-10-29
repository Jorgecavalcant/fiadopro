import './webhookTestEnv.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pool, { query } from '../../config/database.js';
import { getUserPlan } from '../../services/plans.js';
import billingRouter from '../billing.js';

if (process.env.DB_PORT !== '55435' || process.env.DB_NAME === 'fiado_pro') {
  throw new Error('Teste recusou o banco: só a porta 55435.');
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

async function applyFile(filename: string, rewrite = false) {
  let source = readFileSync(join(migrationsDir, filename), 'utf8');
  if (rewrite) {
    source = source
      .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
      .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
  }
  for (const statement of splitSql(source)) await query(statement);
}

async function post(body: unknown) {
  return fetch(`${baseUrl}/api/billing/webhook/asaas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || '',
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55435, host: '127.0.0.1' });
  await pgServer.start();
  const where = await query(`SELECT current_database() AS name`);
  if (where.rows[0]?.name === 'fiado_pro') throw new Error('Banco de produção.');

  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN DEFAULT TRUE,
      deleted_at TIMESTAMPTZ
    )
  `);
  await applyFile('006_billing.sql', true);
  await applyFile('008_billing_cancel.sql');
  await applyFile('013_plan_model.sql');
  await applyFile('014_billing_webhook_events.sql');

  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRouter);
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

async function subscriber(asaasId: string): Promise<string> {
  const id = randomUUID();
  await query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [id, `${id}@example.test`]);
  await query(
    `INSERT INTO subscriptions (user_id, plan, status, asaas_subscription_id, current_period_end)
     VALUES ($1, 'FREE', 'PENDING', $2, NULL)`,
    [id, asaasId],
  );
  return id;
}

describe('webhook do plano no banco local', () => {
  it('pagamento confirmado libera e a repetição não muda a validade', async () => {
    const asaasId = `sub_${randomUUID()}`;
    const userId = await subscriber(asaasId);
    const payload = {
      id: `evt_${randomUUID()}`,
      event: 'PAYMENT_CONFIRMED',
      payment: { id: 'pay_1', subscription: asaasId },
    };
    const first = await post(payload);
    expect(first.status).toBe(200);
    await expect(getUserPlan(userId)).resolves.toBe('PRO');
    const before = await query(`SELECT current_period_end FROM subscriptions WHERE user_id = $1`, [
      userId,
    ]);

    const second = await post(payload);
    expect(second.status).toBe(200);
    const after = await query(`SELECT current_period_end FROM subscriptions WHERE user_id = $1`, [
      userId,
    ]);
    expect(new Date(after.rows[0].current_period_end).toISOString()).toBe(
      new Date(before.rows[0].current_period_end).toISOString(),
    );
  });

  it('atraso não corta o período que ainda está pago', async () => {
    const asaasId = `sub_${randomUUID()}`;
    const userId = await subscriber(asaasId);
    await query(
      `UPDATE subscriptions
          SET plan = 'PRO', status = 'active', current_period_end = NOW() + INTERVAL '10 days'
        WHERE user_id = $1`,
      [userId],
    );
    const res = await post({
      id: `evt_${randomUUID()}`,
      event: 'PAYMENT_OVERDUE',
      payment: { subscription: asaasId },
    });
    expect(res.status).toBe(200);
    await expect(getUserPlan(userId)).resolves.toBe('PRO');
    const row = await query(`SELECT plan, status FROM subscriptions WHERE user_id = $1`, [userId]);
    expect(row.rows[0]).toMatchObject({ plan: 'PRO', status: 'active' });
  });

  it('estorno não apaga a cortesia que ainda vale', async () => {
    const asaasId = `sub_${randomUUID()}`;
    const userId = await subscriber(asaasId);
    await query(
      `UPDATE subscriptions
          SET plan = 'PRO', status = 'active', current_period_end = NOW() + INTERVAL '5 days',
              grant_plan = 'ENTERPRISE', grant_source = 'cortesia',
              grant_expires_at = NOW() + INTERVAL '3 days'
        WHERE user_id = $1`,
      [userId],
    );
    const res = await post({
      id: `evt_${randomUUID()}`,
      event: 'PAYMENT_REFUNDED',
      payment: { subscription: asaasId },
    });
    expect(res.status).toBe(200);
    const row = await query(`SELECT plan, grant_plan FROM subscriptions WHERE user_id = $1`, [
      userId,
    ]);
    expect(row.rows[0].plan).toBe('FREE');
    expect(row.rows[0].grant_plan).toBe('ENTERPRISE');
    await expect(getUserPlan(userId)).resolves.toBe('ENTERPRISE');
  });
});
