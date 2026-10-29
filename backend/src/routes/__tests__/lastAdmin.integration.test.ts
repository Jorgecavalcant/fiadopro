import './lastAdminTestEnv.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import { signToken } from '../../utils/jwt.js';
import pool, { query } from '../../config/database.js';
import usersRouter from '../users.js';
import adminRouter from '../admin.js';
import { purgeExpiredAccounts } from '../../services/accountPurge.js';

vi.mock('../../services/email.js', () => ({
  sendAccountDeletionEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_PORT !== '55432' || process.env.DB_NAME === 'fiado_pro') {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55432.');
}

const SOLE = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';
const REGULAR = '33333333-3333-4333-8333-333333333333';
const HELD = '44444444-4444-4444-8444-444444444444';
const FREE = '55555555-5555-4555-8555-555555555555';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let httpServer: Server;
let pgServer: PGLiteSocketServer;
let db: PGlite;
let baseUrl: string;

async function json(res: Response): Promise<{ success?: boolean; error?: { code?: string; message?: string } }> {
  return (await res.json()) as { success?: boolean; error?: { code?: string; message?: string } };
}

function cookieFor(id: string, email: string) {
  return { Cookie: `fiado_token=${signToken({ sub: id, email })}` };
}

async function insertUser(id: string, email: string, role: 'admin' | 'user') {
  await query(
    `INSERT INTO users (id, email, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [id, email, role === 'admin' ? 'Admin de teste' : 'Usuario de teste', role],
  );
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55432, host: '127.0.0.1' });
  await pgServer.start();

  const where = await query(`SELECT current_database() AS name`);
  if (where.rows[0]?.name === 'fiado_pro') {
    throw new Error('O teste conectou no banco de produção e foi interrompido.');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      avatar_url VARCHAR(500),
      phone VARCHAR(20),
      cpf VARCHAR(14),
      pix_key VARCHAR(140),
      google_id VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      deleted_at TIMESTAMPTZ,
      deleted_reason TEXT,
      purge_after TIMESTAMPTZ,
      purge_completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const migration = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../migrations/011_admin_block_audit.sql'),
    'utf8',
  ).replace(/--.*$/gm, '');
  for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) {
    await query(statement);
  }
  await query('CREATE TABLE IF NOT EXISTS debts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID)');
  await query('CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), debt_id UUID)');
  await query('CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id UUID)');
  await query('CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_user_id UUID)');
  await query('CREATE TABLE IF NOT EXISTS ai_interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID)');
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token TEXT,
      used BOOLEAN DEFAULT FALSE
    )
  `);

  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30000);

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

beforeEach(async () => {
  await query('DELETE FROM admin_audit_log');
  await query('DELETE FROM payments');
  await query('DELETE FROM debts');
  await query('DELETE FROM transactions');
  await query('DELETE FROM customers');
  await query('DELETE FROM ai_interactions');
  await query('DELETE FROM users');
});

describe('trava do último administrador', () => {
  it('o único admin tenta encerrar a própria conta e é recusado', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(SOLE, 'sole-admin@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'CANCELAR' }),
    });
    const body = await json(res);

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('LAST_ADMIN');
    expect(body.error?.message).toMatch(/único administrador/i);

    const still = await query('SELECT is_active, deleted_at IS NULL AS aberta FROM users WHERE id = $1', [SOLE]);
    expect(still.rows[0]).toEqual({ is_active: true, aberta: true });
  });

  it('o único admin tenta se bloquear e é recusado', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');

    const res = await fetch(`${baseUrl}/api/admin/users/${SOLE}`, {
      method: 'PATCH',
      headers: { ...cookieFor(SOLE, 'sole-admin@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
    const body = await json(res);

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('LAST_ADMIN');
    expect(body.error?.message).toMatch(/último administrador/i);

    const still = await query('SELECT is_active FROM users WHERE id = $1', [SOLE]);
    expect(still.rows[0].is_active).toBe(true);
  });

  it('com 2 admins ativos, um consegue encerrar a própria conta', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(SECOND, 'second-admin@example.test', 'admin');

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(SOLE, 'sole-admin@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'CANCELAR' }),
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = await query(
      `SELECT id, is_active, deleted_at IS NULL AS aberta, role
         FROM users ORDER BY email`,
    );
    const closed = rows.rows.find((row) => row.id === SOLE);
    const kept = rows.rows.find((row) => row.id === SECOND);
    expect(closed.aberta).toBe(false);
    expect(closed.is_active).toBe(false);
    expect(kept).toMatchObject({ is_active: true, aberta: true, role: 'admin' });
  });

  it('um usuário comum continua conseguindo encerrar a conta normalmente', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(REGULAR, 'regular-user@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'CANCELAR' }),
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const row = await query('SELECT is_active, deleted_at IS NULL AS aberta FROM users WHERE id = $1', [REGULAR]);
    expect(row.rows[0]).toEqual({ is_active: false, aberta: false });
  });

  it('um usuário comum não consegue chamar rota de admin', async () => {
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: cookieFor(REGULAR, 'regular-user@example.test'),
    });
    const body = await json(res);

    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('FORBIDDEN');
  });
});

describe('bloqueio com motivo e registro do admin', () => {
  const adminHeaders = () => ({
    ...cookieFor(SOLE, 'sole-admin@example.test'),
    'Content-Type': 'application/json',
  });

  async function block(body: Record<string, unknown>) {
    return fetch(`${baseUrl}/api/admin/users/${REGULAR}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify(body),
    });
  }

  it('recusa bloquear sem motivo e não grava registro', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await block({ is_active: false });
    const body = await json(res);

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    const still = await query('SELECT is_active FROM users WHERE id = $1', [REGULAR]);
    expect(still.rows[0].is_active).toBe(true);
    const audit = await query('SELECT COUNT(*)::int AS total FROM admin_audit_log');
    expect(audit.rows[0].total).toBe(0);
  });

  it('recusa bloqueio judicial sem observação', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await block({ is_active: false, block_reason: 'judicial', block_note: 'curta' });
    const body = await json(res);

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    const still = await query('SELECT legal_hold FROM users WHERE id = $1', [REGULAR]);
    expect(still.rows[0].legal_hold).toBe(false);
  });

  it('grava o bloqueio judicial e o registro na mesma ação', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await block({
      is_active: false,
      block_reason: 'judicial',
      block_note: 'Oficio 12 do juizo civel',
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const row = await query(
      'SELECT is_active, legal_hold, block_reason, blocked_by FROM users WHERE id = $1',
      [REGULAR],
    );
    expect(row.rows[0]).toMatchObject({
      is_active: false,
      legal_hold: true,
      block_reason: 'judicial',
      blocked_by: SOLE,
    });

    const audit = await query(
      'SELECT action, reason, note, before_state, after_state FROM admin_audit_log',
    );
    expect(audit.rows).toHaveLength(1);
    const entry = audit.rows[0];
    expect(entry.action).toBe('user.block');
    expect(entry.reason).toBe('judicial');
    expect(JSON.stringify(entry.before_state)).not.toMatch(/@|cpf|pix|password|token/i);
    expect(JSON.stringify(entry.after_state)).not.toMatch(/@|cpf|pix|password|token/i);
    expect(entry.after_state.legal_hold).toBe(true);
  });

  it('impede encerrar a conta enquanto o bloqueio judicial estiver ativo', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');
    await query('UPDATE users SET legal_hold = true WHERE id = $1', [REGULAR]);

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(REGULAR, 'regular-user@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'CANCELAR' }),
    });
    const body = await json(res);

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('LEGAL_HOLD');
    const row = await query(
      'SELECT email, deleted_at IS NULL AS aberta FROM users WHERE id = $1',
      [REGULAR],
    );
    expect(row.rows[0]).toEqual({ email: 'regular-user@example.test', aberta: true });
  });

  it('o purge de 30 dias não apaga quem está sob bloqueio judicial', async () => {
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, legal_hold)
       VALUES ($1, 'held@example.test', 'Preservado', 'user', false, NOW(), NOW() - INTERVAL '1 day', true)`,
      [HELD],
    );
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, legal_hold)
       VALUES ($1, 'free@example.test', 'Liberado', 'user', false, NOW(), NOW() - INTERVAL '1 day', false)`,
      [FREE],
    );
    await query('INSERT INTO debts (user_id) VALUES ($1), ($2)', [HELD, FREE]);

    await purgeExpiredAccounts();

    const rows = await query(
      'SELECT id, purge_completed_at IS NULL AS pendente FROM users WHERE id = ANY($1::uuid[])',
      [[HELD, FREE]],
    );
    const held = rows.rows.find((row) => row.id === HELD);
    const freed = rows.rows.find((row) => row.id === FREE);
    expect(held.pendente).toBe(true);
    expect(freed.pendente).toBe(false);

    const debts = await query('SELECT user_id FROM debts');
    expect(debts.rows.map((row) => row.user_id)).toEqual([HELD]);
  });

  it('um usuário comum não lê o registro', async () => {
    await insertUser(REGULAR, 'regular-user@example.test', 'user');
    const res = await fetch(`${baseUrl}/api/admin/audit`, {
      headers: cookieFor(REGULAR, 'regular-user@example.test'),
    });
    const body = await json(res);
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('o único admin continua travado mesmo com motivo', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    const res = await fetch(`${baseUrl}/api/admin/users/${SOLE}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({
        is_active: false,
        block_reason: 'fraude',
        block_note: 'Tentativa de bloquear o unico admin',
      }),
    });
    const body = await json(res);
    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('LAST_ADMIN');
    const still = await query('SELECT is_active, legal_hold FROM users WHERE id = $1', [SOLE]);
    expect(still.rows[0]).toEqual({ is_active: true, legal_hold: false });
  });

  it('fraude só suspende o acesso e não cria bloqueio judicial', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await insertUser(REGULAR, 'regular-user@example.test', 'user');

    const res = await block({ is_active: false, block_reason: 'fraude' });
    expect(res.status).toBe(200);
    const row = await query('SELECT is_active, legal_hold FROM users WHERE id = $1', [REGULAR]);
    expect(row.rows[0]).toEqual({ is_active: false, legal_hold: false });
  });

  it('liberar o bloqueio judicial devolve os 30 dias da exclusão', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, legal_hold, block_reason)
       VALUES ($1, 'held-closed@example.test', 'Preservado', 'user', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', true, 'judicial')`,
      [HELD],
    );

    const res = await fetch(`${baseUrl}/api/admin/users/${HELD}`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ is_active: true, unblock_note: 'Ordem judicial cumprida' }),
    });
    expect(res.status).toBe(200);

    const row = await query(
      `SELECT legal_hold, is_active, purge_after > NOW() AS prazo_voltou
         FROM users WHERE id = $1`,
      [HELD],
    );
    expect(row.rows[0]).toEqual({ legal_hold: false, is_active: false, prazo_voltou: true });
  });
});
