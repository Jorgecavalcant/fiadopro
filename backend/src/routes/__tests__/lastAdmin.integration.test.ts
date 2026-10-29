import './lastAdminTestEnv.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
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
import authRouter from '../auth.js';
import transactionsRouter from '../transactions.js';
import customersRouter from '../customers.js';
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
const PERSON = '66666666-6666-4666-8666-666666666666';
const CLOSED = '77777777-7777-4777-8777-777777777777';
const MERCHANT = '88888888-8888-4888-8888-888888888888';
const CUST = '99999999-9999-4999-8999-999999999999';
const TX = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/customers', customersRouter);
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

function hasSession(res: Response) {
  return (res.headers.get('set-cookie') || '').includes('fiado_token');
}

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

async function applyMigration(filename: string) {
  const migration = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../migrations', filename),
    'utf8',
  );
  for (const statement of splitSql(migration)) {
    await query(statement);
  }
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
  await applyMigration('015_email_confirmation.sql');
  await applyMigration('011_admin_block_audit.sql');
  await query('CREATE TABLE IF NOT EXISTS debts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID)');
  await query('CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), debt_id UUID)');
  await query(`CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    owner_user_id UUID,
    created_by_user_id UUID,
    type TEXT,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    amount NUMERIC,
    description TEXT,
    CONSTRAINT transactions_status_check CHECK (status IN ('CONFIRMED','PENDING','REJECTED'))
  )`);
  await query(`CREATE TABLE IF NOT EXISTS transaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    actor_user_id UUID,
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transaction_events_action_check CHECK (action IN ('CREATED','APPROVED','REJECTED','RESENT'))
  )`);
  await query(`CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID,
    linked_user_id UUID,
    name TEXT,
    phone TEXT,
    email TEXT,
    deleted_at TIMESTAMPTZ
  )`);
  await query('CREATE TABLE IF NOT EXISTS ai_interactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID)');
  await applyMigration('012_account_reactivation.sql');
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
  await query('DELETE FROM transaction_events');
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

describe('conta encerrada pode voltar na mesma conta', () => {
  it('o único admin continua sem poder encerrar a própria conta', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(SOLE, 'sole-admin@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'CANCELAR' }),
    });
    const body = await json(res);

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('LAST_ADMIN');
    const still = await query(
      'SELECT is_active, deleted_at IS NULL AS aberta, login_retained FROM users WHERE id = $1',
      [SOLE],
    );
    expect(still.rows[0]).toEqual({ is_active: true, aberta: true, login_retained: false });
  });

  it('encerrar mantém e-mail e nome, zera cpf e pix, e marca o prazo', async () => {
    const secret = randomUUID();
    const hash = await bcrypt.hash(secret, 4);
    await query(
      `INSERT INTO users (id, email, full_name, password_hash, role, is_active, cpf, pix_key)
       VALUES ($1, 'pessoa@example.test', 'Pessoa de teste', $2, 'user', true, 'doc-local', 'chave-local')`,
      [PERSON, hash],
    );

    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(PERSON, 'pessoa@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: secret }),
    });
    expect(res.status).toBe(200);

    const row = await query(
      `SELECT email, full_name, cpf, pix_key, is_active, login_retained,
              deleted_at IS NOT NULL AS encerrada, purge_after > NOW() AS no_prazo
         FROM users WHERE id = $1`,
      [PERSON],
    );
    expect(row.rows[0]).toEqual({
      email: 'pessoa@example.test',
      full_name: 'Pessoa de teste',
      cpf: null,
      pix_key: null,
      is_active: false,
      login_retained: true,
      encerrada: true,
      no_prazo: true,
    });
  });

  it('reativar dentro de 30 dias devolve o mesmo id e os dados guardados', async () => {
    const secret = randomUUID();
    const hash = await bcrypt.hash(secret, 4);
    await query(
      `INSERT INTO users (id, email, full_name, password_hash, role, is_active, phone)
       VALUES ($1, 'pessoa@example.test', 'Pessoa de teste', $2, 'user', true, '11900000000')`,
      [PERSON, hash],
    );
    await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { ...cookieFor(PERSON, 'pessoa@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: secret }),
    });

    const blocked = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pessoa@example.test', password: secret }),
    });
    const blockedBody = await json(blocked);
    expect(blocked.status).toBe(409);
    expect(blockedBody.error?.code).toBe('ACCOUNT_CLOSED');
    expect(hasSession(blocked)).toBe(false);

    const wrong = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pessoa@example.test', password: randomUUID() }),
    });
    expect(wrong.status).toBe(401);
    expect(hasSession(wrong)).toBe(false);

    const back = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pessoa@example.test', password: secret, reactivate: true }),
    });
    const backBody = await back.json() as { user?: { id?: string; email?: string; full_name?: string } };
    expect(back.status).toBe(200);
    expect(hasSession(back)).toBe(true);
    expect(backBody.user?.id).toBe(PERSON);
    expect(backBody.user?.email).toBe('pessoa@example.test');
    expect(backBody.user?.full_name).toBe('Pessoa de teste');

    const row = await query(
      'SELECT phone, deleted_at IS NULL AS aberta, is_active, login_retained FROM users WHERE id = $1',
      [PERSON],
    );
    expect(row.rows[0]).toEqual({
      phone: '11900000000',
      aberta: true,
      is_active: true,
      login_retained: false,
    });
  });

  it('depois do purge a mesma conta não volta', async () => {
    const secret = randomUUID();
    const hash = await bcrypt.hash(secret, 4);
    await query(
      `INSERT INTO users (id, email, full_name, password_hash, role, is_active, deleted_at, purge_after, login_retained)
       VALUES ($1, 'pessoa@example.test', 'Pessoa de teste', $2, 'user', false, NOW(), NOW() - INTERVAL '1 day', true)`,
      [PERSON, hash],
    );

    await purgeExpiredAccounts();

    const row = await query(
      `SELECT login_retained, purge_completed_at IS NOT NULL AS purgada, email
         FROM users WHERE id = $1`,
      [PERSON],
    );
    expect(row.rows[0].login_retained).toBe(false);
    expect(row.rows[0].purgada).toBe(true);
    expect(String(row.rows[0].email)).toMatch(/^deleted_.+@removed\.invalid$/);

    const back = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pessoa@example.test', password: secret, reactivate: true }),
    });
    expect(back.status).toBe(401);
    expect(hasSession(back)).toBe(false);
  });

  it('ordem judicial tira a conta da fila e não devolve sessão', async () => {
    const secret = randomUUID();
    const hash = await bcrypt.hash(secret, 4);
    await query(
      `INSERT INTO users (id, email, full_name, password_hash, role, is_active, deleted_at, purge_after, login_retained, legal_hold)
       VALUES ($1, 'pessoa@example.test', 'Pessoa de teste', $2, 'user', false, NOW(), NOW() + INTERVAL '10 days', true, true)`,
      [PERSON, hash],
    );

    const back = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pessoa@example.test', password: secret, reactivate: true }),
    });
    const body = await json(back);
    expect(back.status).toBe(409);
    expect(body.error?.code).toBe('LEGAL_HOLD');
    expect(hasSession(back)).toBe(false);

    const row = await query(
      'SELECT is_active, legal_hold, deleted_at IS NULL AS aberta, login_retained FROM users WHERE id = $1',
      [PERSON],
    );
    expect(row.rows[0]).toEqual({
      is_active: false,
      legal_hold: true,
      aberta: true,
      login_retained: false,
    });
  });

  it('lançamento novo contra conta encerrada é recusado', async () => {
    await insertUser(MERCHANT, 'loja@example.test', 'user');
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, login_retained)
       VALUES ($1, 'fechada@example.test', 'Conta fechada', 'user', false, NOW(), NOW() + INTERVAL '10 days', true)`,
      [CLOSED],
    );
    await query(
      `INSERT INTO customers (id, owner_user_id, linked_user_id, name, phone)
       VALUES ($1, $2, $3, 'Cliente', '11911110000')`,
      [CUST, MERCHANT, CLOSED],
    );

    const res = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST',
      headers: { ...cookieFor(MERCHANT, 'loja@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: CUST,
        type: 'DEBT',
        amount: 10,
        description: 'fiado novo',
      }),
    });
    const body = await json(res);
    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('ACCOUNT_CLOSED');
    const count = await query('SELECT COUNT(*)::int AS total FROM transactions');
    expect(count.rows[0].total).toBe(0);
  });

  it('cancelar pendente preso grava CANCELLED e um evento', async () => {
    await insertUser(MERCHANT, 'loja@example.test', 'user');
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, login_retained)
       VALUES ($1, 'fechada@example.test', 'Conta fechada', 'user', false, NOW(), NOW() + INTERVAL '10 days', true)`,
      [CLOSED],
    );
    await query(
      `INSERT INTO customers (id, owner_user_id, linked_user_id, name, phone)
       VALUES ($1, $2, $3, 'Cliente', '11911110000')`,
      [CUST, MERCHANT, CLOSED],
    );
    await query(
      `INSERT INTO transactions (id, customer_id, owner_user_id, created_by_user_id, type, status, amount, description)
       VALUES ($1, $2, $3, $4, 'PAYMENT', 'PENDING', 15, 'pagamento preso')`,
      [TX, CUST, MERCHANT, CLOSED],
    );

    const res = await fetch(`${baseUrl}/api/transactions/${TX}/cancel`, {
      method: 'POST',
      headers: cookieFor(MERCHANT, 'loja@example.test'),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const tx = await query('SELECT status FROM transactions WHERE id = $1', [TX]);
    expect(tx.rows[0].status).toBe('CANCELLED');
    const events = await query(
      'SELECT action FROM transaction_events WHERE transaction_id = $1',
      [TX],
    );
    expect(events.rows).toEqual([{ action: 'CANCELLED' }]);
  });

  it('cadastrar a si mesmo pelo mesmo telefone é recusado', async () => {
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, phone)
       VALUES ($1, 'loja@example.test', 'Loja de teste', 'user', true, '11900000000')`,
      [MERCHANT],
    );

    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { ...cookieFor(MERCHANT, 'loja@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Eu mesmo', phone: '(11) 90000-0000' }),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error?.message).toBe('Esse telefone é o seu.');
    const count = await query('SELECT COUNT(*)::int AS total FROM customers');
    expect(count.rows[0].total).toBe(0);
  });

  it('quem não é admin não lista contas encerradas', async () => {
    await insertUser(REGULAR, 'regular-user@example.test', 'user');
    const res = await fetch(`${baseUrl}/api/admin/users/closed`, {
      headers: cookieFor(REGULAR, 'regular-user@example.test'),
    });
    const body = await json(res);
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe('FORBIDDEN');
  });

  it('o admin reativa e o registro não leva dado de contato', async () => {
    await insertUser(SOLE, 'sole-admin@example.test', 'admin');
    await query(
      `INSERT INTO users (id, email, full_name, role, is_active, deleted_at, purge_after, login_retained, phone)
       VALUES ($1, 'pessoa@example.test', 'Pessoa de teste', 'user', false, NOW(), NOW() + INTERVAL '10 days', true, '11900000000')`,
      [PERSON],
    );

    const res = await fetch(`${baseUrl}/api/admin/users/${PERSON}/reactivate`, {
      method: 'POST',
      headers: { ...cookieFor(SOLE, 'sole-admin@example.test'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Pedido conferido no balcao' }),
    });
    const body = await res.json() as { success?: boolean; user?: { id?: string; email?: string } };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user?.id).toBe(PERSON);
    expect(body.user?.email).toBeUndefined();

    const row = await query(
      'SELECT is_active, deleted_at IS NULL AS aberta FROM users WHERE id = $1',
      [PERSON],
    );
    expect(row.rows[0]).toEqual({ is_active: true, aberta: true });

    const audit = await query(
      'SELECT action, note, before_state, after_state FROM admin_audit_log',
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].action).toBe('user.reactivate');
    const dumped = JSON.stringify(audit.rows[0]);
    expect(dumped).not.toMatch(/@|11900000000|cpf|pix|password/i);
  });
});
