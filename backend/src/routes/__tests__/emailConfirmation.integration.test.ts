import './emailConfirmTestEnv.js';
import { createHash, randomUUID } from 'node:crypto';
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
import { errorHandler } from '../../middleware/errorHandler.js';

const { mockVerifyIdToken, mockSendConfirmation } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockSendConfirmation: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

vi.mock('../../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendAccountDeletionEmail: vi.fn(),
  sendEmailConfirmation: (...args: unknown[]) => mockSendConfirmation(...args),
}));

vi.mock('../../services/linking.js', () => ({
  relinkCustomersForUser: vi.fn().mockResolvedValue(0),
  ensureAdminRole: vi.fn().mockResolvedValue(undefined),
}));

import pool, { query } from '../../config/database.js';
import authRouter from '../auth.js';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55441' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55441.');
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use(errorHandler);

let httpServer: Server;
let pgServer: PGLiteSocketServer;
let db: PGlite;
let baseUrl: string;

type ApiBody = {
  success?: boolean;
  message?: string;
  user?: { id?: string; email?: string };
  error?: { code?: string; message?: string };
};

function sessionCookie(res: globalThis.Response): boolean {
  const parts = [
    ...(typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []),
    res.headers.get('set-cookie') ?? '',
  ];
  return parts.join(';').includes('fiado_token');
}

function testEmail(): string {
  return `pessoa-${randomUUID()}@example.test`;
}

function testPassword(): string {
  return `A${randomUUID()}9`;
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

async function readBody(res: globalThis.Response): Promise<ApiBody> {
  return (await res.json()) as ApiBody;
}

async function register(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Pessoa Teste',
      email,
      password,
      consent: true,
    }),
  });
}

async function login(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

function lastToken(): string {
  const call = mockSendConfirmation.mock.calls.at(-1);
  const token = call?.[1];
  if (typeof token !== 'string' || token.length < 32) {
    throw new Error('O teste nao recebeu o token de confirmacao.');
  }
  return token;
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55441, host: '127.0.0.1' });
  await pgServer.start();

  const where = await query('SELECT current_database() AS name');
  if (where.rows[0]?.name === 'fiado_pro') {
    throw new Error('O teste conectou no banco de produção e foi interrompido.');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      avatar_url VARCHAR(500),
      google_id VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      consent_at TIMESTAMPTZ,
      consent_ip VARCHAR(45),
      deleted_at TIMESTAMPTZ,
      purge_completed_at TIMESTAMPTZ,
      purge_after TIMESTAMPTZ,
      login_retained BOOLEAN NOT NULL DEFAULT FALSE,
      legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await applyMigration('015_email_confirmation.sql');
  await applyMigration('015_email_confirmation.sql');

  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30000);

afterAll(async () => {
  delete process.env.REQUIRE_EMAIL_CONFIRMATION;
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

beforeEach(async () => {
  delete process.env.REQUIRE_EMAIL_CONFIRMATION;
  mockSendConfirmation.mockReset();
  mockSendConfirmation.mockResolvedValue(undefined);
  mockVerifyIdToken.mockReset();
  await query('DELETE FROM email_confirmation_tokens');
  await query('DELETE FROM users');
});

describe('confirmacao de e-mail no cadastro', () => {
  it('com a flag desligada, o cadastro devolve sessao e o login entra', async () => {
    const email = testEmail();
    const password = testPassword();
    const created = await register(email, password);
    const createdBody = await readBody(created);

    expect(created.status).toBe(201);
    expect(sessionCookie(created)).toBe(true);
    expect(createdBody.user?.id).toBeTruthy();
    expect(createdBody.message ?? '').not.toMatch(/confirma/i);

    const entered = await login(email, password);
    expect(entered.status).toBe(200);
    expect(sessionCookie(entered)).toBe(true);
  }, 20000);

  it('false, vazio, TRUE e 1 continuam desligados', async () => {
    for (const value of ['false', '', 'TRUE', '1']) {
      process.env.REQUIRE_EMAIL_CONFIRMATION = value;
      const created = await register(testEmail(), testPassword());
      expect(created.status).toBe(201);
      expect(sessionCookie(created)).toBe(true);
      await created.json();
    }
  }, 20000);

  it('conta antiga entra normalmente quando a flag esta ligada', async () => {
    const email = testEmail();
    const password = testPassword();
    const created = await register(email, password);
    const createdBody = await readBody(created);
    expect(sessionCookie(created)).toBe(true);

    process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
    const entered = await login(email, password);
    const enteredBody = await readBody(entered);
    expect(entered.status).toBe(200);
    expect(sessionCookie(entered)).toBe(true);
    expect(enteredBody.error?.message ?? '').not.toMatch(/Confirme seu e-mail/);

    const row = await query(
      `SELECT email_confirmation_required, email_confirmed_at
         FROM users WHERE id = $1`,
      [createdBody.user?.id],
    );
    expect(row.rows[0].email_confirmation_required).toBe(false);
    expect(row.rows[0].email_confirmed_at).toBeNull();
  }, 20000);

  it('com a flag ligada, o cadastro nao cria sessao, o login espera o clique e o token so vale uma vez', async () => {
    process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
    const email = testEmail();
    const password = testPassword();
    const created = await register(email, password);
    const createdBody = await readBody(created);

    expect(created.status).toBe(201);
    expect(sessionCookie(created)).toBe(false);
    expect(createdBody.user).toBeUndefined();
    expect(createdBody.message).toMatch(/link de confirmação/i);
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);

    const token = lastToken();
    const hash = createHash('sha256').update(token).digest('hex');
    const stored = await query(
      `SELECT t.token_hash, t.used_at, t.expires_at,
              u.email_confirmation_required, u.email_confirmed_at
         FROM email_confirmation_tokens t
         JOIN users u ON u.id = t.user_id`,
    );
    expect(stored.rows[0].token_hash).toBe(hash);
    expect(stored.rows[0].token_hash).not.toBe(token);
    expect(stored.rows[0].used_at).toBeNull();
    expect(stored.rows[0].email_confirmation_required).toBe(true);
    expect(stored.rows[0].email_confirmed_at).toBeNull();
    const aheadMs = new Date(stored.rows[0].expires_at).getTime() - Date.now();
    expect(aheadMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(aheadMs).toBeLessThan(25 * 60 * 60 * 1000);

    const denied = await login(email, password);
    const deniedBody = await readBody(denied);
    expect(denied.status).toBe(403);
    expect(sessionCookie(denied)).toBe(false);
    expect(deniedBody.error?.code).toBe('EMAIL_NOT_CONFIRMED');
    expect(deniedBody.error?.message).toMatch(/Confirme seu e-mail/);

    const confirmed = await fetch(
      `${baseUrl}/api/auth/confirm-email?token=${encodeURIComponent(token)}`,
    );
    const confirmedBody = await readBody(confirmed);
    expect(confirmed.status).toBe(200);
    expect(confirmedBody.message).toMatch(/E-mail confirmado/);

    const again = await fetch(
      `${baseUrl}/api/auth/confirm-email?token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const againBody = await readBody(again);
    expect(again.status).toBe(400);
    expect(againBody.error?.message).toMatch(/inválido ou vencido/i);
    expect(JSON.stringify(againBody)).not.toContain('@');

    const entered = await login(email, password);
    expect(entered.status).toBe(200);
    expect(sessionCookie(entered)).toBe(true);
  }, 20000);

  it('POST com o token certo tambem confirma', async () => {
    process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
    const email = testEmail();
    const password = testPassword();
    await register(email, password);
    const token = lastToken();
    const confirmed = await fetch(
      `${baseUrl}/api/auth/confirm-email?token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    expect(confirmed.status).toBe(200);
    const entered = await login(email, password);
    expect(entered.status).toBe(200);
    expect(sessionCookie(entered)).toBe(true);
  }, 20000);

  it('token invalido responde sem revelar e-mail', async () => {
    const res = await fetch(
      `${baseUrl}/api/auth/confirm-email?token=${randomUUID().replace(/-/g, '')}`,
    );
    const body = await readBody(res);
    expect(res.status).toBe(400);
    expect(body.error?.message).toMatch(/inválido ou vencido/i);
    expect(JSON.stringify(body)).not.toContain('@');
  });

  it('se o envio falha, a conta fica criada e a resposta nao vaza o erro', async () => {
    process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
    mockSendConfirmation.mockRejectedValueOnce(new Error('falha interna do envio'));
    const created = await register(testEmail(), testPassword());
    const body = await readBody(created);
    const text = JSON.stringify(body);
    expect(created.status).toBe(201);
    expect(sessionCookie(created)).toBe(false);
    expect(body.message).toMatch(/não pôde ser enviada/);
    expect(text).not.toContain('falha interna');
    expect(text).not.toMatch(/\.ts:\d+/);
    const count = await query('SELECT count(*)::int AS total FROM users');
    expect(count.rows[0].total).toBe(1);
  }, 20000);

  it('Google entra com a flag ligada e nao altera o google_id de outra conta', async () => {
    process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
    const otherEmail = testEmail();
    await query(`INSERT INTO users (email, full_name) VALUES ($1, 'Outra pessoa')`, [otherEmail]);

    const pendingEmail = testEmail();
    const pendingPassword = testPassword();
    const pending = await register(pendingEmail, pendingPassword);
    expect(sessionCookie(pending)).toBe(false);

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: `sub-${randomUUID()}`,
        email: pendingEmail,
        name: 'Pessoa Teste',
      }),
    });
    const byGoogle = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: randomUUID() }),
    });
    expect(byGoogle.status).toBe(200);
    expect(sessionCookie(byGoogle)).toBe(true);

    const stillPending = await login(pendingEmail, pendingPassword);
    expect(stillPending.status).toBe(403);

    const freshEmail = testEmail();
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: `sub-${randomUUID()}`,
        email: freshEmail,
        name: 'Pessoa Google',
      }),
    });
    const fresh = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: randomUUID() }),
    });
    expect(fresh.status).toBe(200);
    expect(sessionCookie(fresh)).toBe(true);

    const other = await query(`SELECT google_id FROM users WHERE email = $1`, [otherEmail]);
    expect(other.rows[0].google_id).toBeNull();
    const people = await query('SELECT count(*)::int AS total FROM users');
    expect(people.rows[0].total).toBe(3);
  }, 20000);
});
