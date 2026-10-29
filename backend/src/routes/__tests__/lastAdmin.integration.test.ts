import './lastAdminTestEnv.js';
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
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
