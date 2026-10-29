import './planGrantTestEnv.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountDeletionEmail: vi.fn().mockResolvedValue(undefined),
}));
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { errorHandler } from '../../middleware/errorHandler.js';
import pool, { query } from '../../config/database.js';
import { getUserPlan, TRIAL_DAYS } from '../plans.js';
import { signToken } from '../../utils/jwt.js';
import adminRouter from '../../routes/admin.js';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55436' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55436.');
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

let pgServer: PGLiteSocketServer;
let db: PGlite;
let httpServer: Server;
let baseUrl: string;
let adminId: string;
let adminToken: string;
let userToken: string;

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

async function insertUser(
  role: 'user' | 'admin' = 'user',
  name = 'Pessoa de teste',
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${id}@example.test`;
  await query(
    `INSERT INTO users (id, email, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [id, email, name, role],
  );
  return { id, email };
}

function futureIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function paidColumns(userId: string) {
  const result = await query(
    `SELECT plan, status, current_period_end::text AS period_end,
            asaas_customer_id, asaas_subscription_id
       FROM subscriptions
      WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0];
}

async function call(method: 'GET' | 'POST', path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Cookie = `fiado_token=${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json()) as {
    error?: { code?: string; message?: string };
    grant?: { plan?: string; source?: string; expiresAt?: string | null };
    promotion?: { id?: string; plan?: string; userCount?: number };
    grants?: Array<{
      id: string;
      name: string;
      plan: string;
      source: string;
      expiresAt: string | null;
    }>;
    promotions?: Array<{ id: string; plan: string; audience: string; userCount: number }>;
  };
  return { status: res.status, data };
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55436, host: '127.0.0.1' });
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
  await applySqlFile('011_admin_block_audit.sql');
  await applySqlFile('013_plan_model.sql');

  const admin = await insertUser('admin', 'Admin de teste');
  adminId = admin.id;
  adminToken = signToken({ sub: admin.id, email: admin.email });
  const regular = await insertUser('user', 'Pessoa comum');
  userToken = signToken({ sub: regular.id, email: regular.email });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
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

describe('concessões de plano no banco local', () => {
  it('só o admin concede: sem sessão 401, pessoa comum 403, admin 200', async () => {
    const anonymous = await call('POST', '/api/admin/grants', null, {
      userId: adminId,
      kind: 'cortesia',
      plan: 'PRO',
      note: 'Tentativa sem sessão válida',
    });
    expect(anonymous.status).toBe(401);

    const person = await insertUser();
    const forbidden = await call('POST', '/api/admin/grants', userToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'PRO',
      expiresAt: futureIso(3),
      note: 'Tentativa de quem não administra',
    });
    expect(forbidden.status).toBe(403);
    expect(await paidColumns(person.id)).toBeUndefined();

    const allowed = await call('GET', '/api/admin/grants', adminToken);
    expect(allowed.status).toBe(200);
    expect(JSON.stringify(allowed.data)).not.toContain('@');
  });

  it('observação com CPF formatado ou com e-mail é 400 e não grava', async () => {
    const person = await insertUser();
    const cpf = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'PRO',
      expiresAt: futureIso(2),
      note: 'motivo 000.000.000-00 aqui',
    });
    expect(cpf.status).toBe(400);
    expect(cpf.data.error?.code).toBe('VALIDATION_ERROR');

    const emailNote = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'PRO',
      expiresAt: futureIso(2),
      note: 'avisar pessoa@example.test hoje',
    });
    expect(emailNote.status).toBe(400);
    expect(emailNote.data.error?.message).toMatch(/e-mail/);

    expect(await paidColumns(person.id)).toBeUndefined();
    const audit = await query(`SELECT id FROM admin_audit_log WHERE target_user_id = $1`, [
      person.id,
    ]);
    expect(audit.rows).toHaveLength(0);
  });

  it('pessoa encerrada não recebe concessão', async () => {
    const person = await insertUser();
    await query(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, [person.id]);
    const closed = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'PRO',
      expiresAt: futureIso(2),
      note: 'Conta encerrada nao recebe',
    });
    expect(closed.status).toBe(404);
    expect(await paidColumns(person.id)).toBeUndefined();

    const missing = await call('POST', '/api/admin/grants', adminToken, {
      userId: randomUUID(),
      kind: 'cortesia',
      plan: 'PRO',
      expiresAt: futureIso(2),
      note: 'Pessoa que nao existe aqui',
    });
    expect(missing.status).toBe(404);
  });

  it('cortesia com prazo volta ao Pro pago e não mexe na assinatura', async () => {
    const person = await insertUser();
    await query(
      `INSERT INTO subscriptions (
         user_id, plan, status, current_period_end, asaas_customer_id, asaas_subscription_id
       )
       VALUES ($1, 'PRO', 'active', NOW() + INTERVAL '20 days', 'cus_local_teste', 'sub_local_teste')`,
      [person.id],
    );
    const before = await paidColumns(person.id);

    const granted = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'ENTERPRISE',
      expiresAt: futureIso(5),
      note: 'Cortesia de acompanhamento',
    });
    expect(granted.status).toBe(200);
    expect(granted.data.grant?.plan).toBe('ENTERPRISE');
    await expect(getUserPlan(person.id)).resolves.toBe('ENTERPRISE');
    expect(await paidColumns(person.id)).toEqual(before);

    const audit = await query(
      `SELECT action, note, before_state::text AS before_state, after_state::text AS after_state
         FROM admin_audit_log
        WHERE target_user_id = $1`,
      [person.id],
    );
    const blob = JSON.stringify(audit.rows);
    expect(blob).not.toContain(person.email);
    expect(blob).not.toContain('@');
    expect(audit.rows[0]?.action).toBe('grant.cortesia');
    const afterState = JSON.parse(String(audit.rows[0]?.after_state)) as {
      grant_plan: string;
      paid_plan: string;
      paid_until: string;
    };
    expect(afterState.grant_plan).toBe('ENTERPRISE');
    expect(afterState.paid_plan).toBe('PRO');
    expect(afterState.paid_until).toBeTruthy();

    await query(
      `UPDATE subscriptions SET grant_expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
      [person.id],
    );
    await expect(getUserPlan(person.id)).resolves.toBe('PRO');
    expect(await paidColumns(person.id)).toEqual(before);

    const listed = await call('GET', '/api/admin/grants', adminToken);
    expect(JSON.stringify(listed.data)).not.toContain(person.email);
    expect(JSON.stringify(listed.data)).not.toContain('Pessoa de teste');
    expect(listed.data.grants?.some((item) => item.id === person.id)).toBe(false);
  });

  it('cortesia sem prazo continua Enterprise mesmo com assinatura Free', async () => {
    const person = await insertUser();
    await query(`INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, 'FREE', 'active')`, [
      person.id,
    ]);
    const granted = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cortesia',
      plan: 'ENTERPRISE',
      expiresAt: null,
      note: 'Cortesia sem data de fim',
    });
    expect(granted.status).toBe(200);
    expect(granted.data.grant?.expiresAt).toBeNull();
    await expect(getUserPlan(person.id)).resolves.toBe('ENTERPRISE');
    const columns = await paidColumns(person.id);
    expect(columns?.plan).toBe('FREE');
    expect(columns?.status).toBe('active');

    const listed = await call('GET', '/api/admin/grants', adminToken);
    const item = listed.data.grants?.find((grant) => grant.id === person.id);
    expect(item?.name).toBe('P*** d*** t***');
    expect(item?.plan).toBe('ENTERPRISE');
    expect(item?.source).toBe('cortesia');
    expect(item?.expiresAt).toBeNull();
    const raw = JSON.stringify(listed.data);
    expect(raw).not.toContain(person.email);
    expect(raw).not.toContain('Pessoa de teste');
    expect(raw).not.toContain('@');
  });

  it('cupom exige prazo futuro e não altera o plano pago', async () => {
    const person = await insertUser();
    await query(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
       VALUES ($1, 'FREE', 'active', NULL)`,
      [person.id],
    );
    const missing = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cupom',
      plan: 'PRO',
      note: 'Cupom sem prazo informado',
    });
    expect(missing.status).toBe(400);

    const granted = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'cupom',
      plan: 'PRO',
      expiresAt: futureIso(4),
      note: 'Cupom de boas vindas local',
    });
    expect(granted.status).toBe(200);
    await expect(getUserPlan(person.id)).resolves.toBe('PRO');
    const columns = await paidColumns(person.id);
    expect(columns?.plan).toBe('FREE');
    expect(columns?.asaas_customer_id ?? null).toBeNull();
  });

  it('teste grátis só vale uma vez e, vencido, volta ao Free sem apagar a linha', async () => {
    const person = await insertUser();
    const first = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'trial',
      plan: 'ENTERPRISE',
      expiresAt: futureIso(30),
      note: 'Teste gratuito desta pessoa',
    });
    expect(first.status).toBe(200);
    expect(first.data.grant?.plan).toBe('PRO');
    expect(first.data.grant?.source).toBe('trial');
    const expires = new Date(String(first.data.grant?.expiresAt)).getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(expires).toBeGreaterThan(Date.now() + (TRIAL_DAYS - 1) * day);
    expect(expires).toBeLessThan(Date.now() + (TRIAL_DAYS + 1) * day);
    await expect(getUserPlan(person.id)).resolves.toBe('PRO');

    const marked = await query(`SELECT trial_used_at FROM users WHERE id = $1`, [person.id]);
    expect(marked.rows[0]?.trial_used_at).toBeTruthy();
    expect((await paidColumns(person.id))?.plan).toBe('FREE');

    const second = await call('POST', '/api/admin/grants', adminToken, {
      userId: person.id,
      kind: 'trial',
      note: 'Segunda tentativa de teste',
    });
    expect(second.status).toBe(409);
    expect(second.data.error?.code).toBe('TRIAL_ALREADY_USED');
    const audits = await query(
      `SELECT COUNT(*)::int AS total FROM admin_audit_log WHERE target_user_id = $1 AND action = 'grant.trial'`,
      [person.id],
    );
    expect(audits.rows[0]?.total).toBe(1);

    await query(
      `UPDATE subscriptions SET grant_expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
      [person.id],
    );
    await expect(getUserPlan(person.id)).resolves.toBe('FREE');
    const still = await query(`SELECT plan FROM subscriptions WHERE user_id = $1`, [person.id]);
    expect(still.rows).toHaveLength(1);
    expect(still.rows[0]?.plan).toBe('FREE');
  });

  it('promoção de lista só muda quem foi escolhido', async () => {
    const chosen = await insertUser();
    const other = await insertUser();
    const empty = await call('POST', '/api/admin/promotions', adminToken, {
      plan: 'PRO',
      expiresAt: futureIso(3),
      audience: 'selected',
      note: 'Lista vazia nao cria pacote',
    });
    expect(empty.status).toBe(400);

    const created = await call('POST', '/api/admin/promotions', adminToken, {
      plan: 'ENTERPRISE',
      expiresAt: futureIso(3),
      audience: 'selected',
      userIds: [chosen.id],
      source: 'cupom',
      note: 'Pacote so para quem foi escolhido',
    });
    expect(created.status).toBe(200);
    expect(created.data.promotion?.userCount).toBe(1);
    await expect(getUserPlan(chosen.id)).resolves.toBe('ENTERPRISE');
    await expect(getUserPlan(other.id)).resolves.toBe('FREE');

    const audit = await query(
      `SELECT note, before_state::text AS before_state, after_state::text AS after_state
         FROM admin_audit_log
        WHERE action = 'promotion.create'
        ORDER BY created_at DESC
        LIMIT 1`,
    );
    const blob = JSON.stringify(audit.rows);
    expect(blob).not.toContain(chosen.email);
    expect(blob).not.toContain(other.email);
  });

  it('promoção da base inteira alcança quem não foi listado', async () => {
    const outsider = await insertUser();
    const rejected = await call('POST', '/api/admin/promotions', adminToken, {
      plan: 'PRO',
      expiresAt: futureIso(2),
      audience: 'all',
      userIds: [outsider.id],
      note: 'Base inteira nao leva lista',
    });
    expect(rejected.status).toBe(400);
    await expect(getUserPlan(outsider.id)).resolves.toBe('FREE');

    const past = await call('POST', '/api/admin/promotions', adminToken, {
      plan: 'PRO',
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      audience: 'all',
      note: 'Prazo passado nao vale',
    });
    expect(past.status).toBe(400);

    let promoId: string | undefined;
    try {
      const created = await call('POST', '/api/admin/promotions', adminToken, {
        plan: 'PRO',
        expiresAt: futureIso(2),
        audience: 'all',
        note: 'Promocao da base inteira agora',
      });
      expect(created.status).toBe(200);
      promoId = created.data.promotion?.id;
      await expect(getUserPlan(outsider.id)).resolves.toBe('PRO');

      const listed = await call('GET', '/api/admin/grants', adminToken);
      const promo = listed.data.promotions?.find((item) => item.id === promoId);
      expect(promo?.audience).toBe('all');
      expect(promo?.plan).toBe('PRO');
      expect(JSON.stringify(listed.data)).not.toContain(outsider.email);
      expect(JSON.stringify(listed.data)).not.toContain('@');

      await query(
        `UPDATE plan_promotions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
        [promoId],
      );
      promoId = undefined;
      await expect(getUserPlan(outsider.id)).resolves.toBe('FREE');
    } finally {
      if (promoId) {
        await query(
          `UPDATE plan_promotions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
          [promoId],
        );
      }
    }
  });
});
