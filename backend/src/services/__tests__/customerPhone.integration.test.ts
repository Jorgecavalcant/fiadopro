import './customerPhoneTestEnv.js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { errorHandler } from '../../middleware/errorHandler.js';
import pool, { query } from '../../config/database.js';
import { signToken } from '../../utils/jwt.js';
import customersRouter from '../../routes/customers.js';
import syncRouter from '../../routes/sync.js';

if (
  process.env.DB_HOST !== '127.0.0.1' ||
  process.env.DB_PORT !== '55439' ||
  process.env.DB_NAME === 'fiado_pro'
) {
  throw new Error('Teste recusou o banco: só o Postgres local da porta 55439.');
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

async function applySql(source: string) {
  for (const statement of splitSql(source)) {
    await query(statement);
  }
}

async function applyBilling() {
  const source = readFileSync(join(migrationsDir, '006_billing.sql'), 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '')
    .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()');
  await applySql(source);
  for (const file of ['008_billing_cancel.sql', '013_plan_model.sql']) {
    await applySql(readFileSync(join(migrationsDir, file), 'utf8'));
  }
}

async function createSchema() {
  await query(
    `CREATE FUNCTION uuid_generate_v4() RETURNS uuid AS $$ SELECT gen_random_uuid() $$ LANGUAGE sql`,
  );
  await query(`
    CREATE FUNCTION fn_norm_phone(raw TEXT)
    RETURNS TEXT
    LANGUAGE sql IMMUTABLE
    AS $$
      SELECT CASE
        WHEN d = '' THEN ''
        WHEN length(d) >= 12 AND d LIKE '55%' THEN ltrim(substring(d FROM 3), '0')
        ELSE ltrim(d, '0')
      END
      FROM (SELECT regexp_replace(coalesce(raw, ''), '\\D', '', 'g') AS d) t;
    $$
  `);
  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'user',
      deleted_at TIMESTAMPTZ,
      purge_completed_at TIMESTAMPTZ
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
  await query(`
    CREATE TABLE transactions (
      id UUID PRIMARY KEY,
      customer_id UUID,
      status TEXT
    )
  `);
}

beforeAll(async () => {
  db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 55439, host: '127.0.0.1' });
  await pgServer.start();

  const where = await query(`SELECT current_database() AS name`);
  if (where.rows[0]?.name === 'fiado_pro') {
    throw new Error('O teste conectou no banco de produção e foi interrompido.');
  }

  await createSchema();
  await applyBilling();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/customers', customersRouter);
  app.use('/api/sync', syncRouter);
  app.use(errorHandler);
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await pool.end();
  if (pgServer) await pgServer.stop();
  if (db) await db.close();
});

async function userOf(): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO users (id, email, full_name, role, is_active)
     VALUES ($1, $2, 'Pessoa de teste', 'user', TRUE)`,
    [id, `${id}@example.test`],
  );
  return id;
}

function cookie(id: string) {
  return { Cookie: `fiado_token=${signToken({ sub: id, email: `${id}@example.test` })}` };
}

async function postCustomer(
  ownerId: string,
  body: { name: string; phone: string; email?: string; pix_key?: string },
) {
  return fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cookie(ownerId) },
    body: JSON.stringify(body),
  });
}

describe('celular repetido na mesma loja', () => {
  it('o segundo cliente com o mesmo celular recebe 409 e o nome do primeiro', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    });
    const ownerId = await userOf();
    const created = await postCustomer(ownerId, {
      name: 'Maria Silva',
      phone: '11988887777',
      email: 'maria.silva@example.test',
      pix_key: 'chave-que-nao-pode-aparecer',
    });
    const createdBody = (await created.json()) as { customer?: { id?: string } };
    expect(created.status).toBe(201);
    const firstId = createdBody.customer?.id;
    expect(firstId).toBeTruthy();

    const duplicate = await postCustomer(ownerId, {
      name: 'Outra Pessoa',
      phone: '+55 (11) 98888-7777',
      email: 'outra.pessoa@example.test',
    });
    const duplicateBody = (await duplicate.json()) as {
      error?: { code?: string; message?: string; existingCustomerId?: string };
    };
    expect(duplicate.status).toBe(409);
    expect(duplicateBody.error?.code).toBe('DUPLICATE_PHONE');
    expect(duplicateBody.error?.message).toBe('Já existe Maria Silva com esse número');
    expect(duplicateBody.error?.existingCustomerId).toBe(firstId);
    expect(duplicateBody.error?.message).not.toContain('example.test');
    expect(duplicateBody.error?.message).not.toContain('chave-que-nao-pode-aparecer');
    expect(JSON.stringify(duplicateBody)).not.toContain('example.test');
    expect(JSON.stringify(duplicateBody)).not.toContain('chave-que-nao-pode-aparecer');

    const renamed = await fetch(`${baseUrl}/api/customers/${firstId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...cookie(ownerId) },
      body: JSON.stringify({ phone: '11988887777', name: 'Maria Silva' }),
    });
    expect(renamed.status).toBe(200);

    const other = await postCustomer(ownerId, {
      name: 'Carlos Souza',
      phone: '11977776666',
    });
    const otherBody = (await other.json()) as { customer?: { id?: string; name?: string } };
    expect(other.status).toBe(201);

    const moved = await fetch(`${baseUrl}/api/customers/${firstId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...cookie(ownerId) },
      body: JSON.stringify({ phone: '11 97777-6666' }),
    });
    const movedBody = (await moved.json()) as {
      error?: { message?: string; existingCustomerId?: string };
    };
    expect(moved.status).toBe(409);
    expect(movedBody.error?.message).toBe('Já existe Carlos Souza com esse número');
    expect(movedBody.error?.existingCustomerId).toBe(otherBody.customer?.id);
    const written = logs.join('\n');
    expect(written).toContain('DUPLICATE_PHONE');
    expect(written).not.toContain('Maria Silva');
    expect(written).not.toContain('Carlos Souza');
    expect(written).not.toContain('11988887777');
    expect(written).not.toContain('97777');
    spy.mockRestore();
  });

  it('a importação offline recusa o celular que já existe', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(' '));
    });
    const ownerId = await userOf();
    const created = await postCustomer(ownerId, { name: 'Lucia Ferreira', phone: '11966665555' });
    const createdBody = (await created.json()) as { customer?: { id?: string } };
    expect(created.status).toBe(201);

    const incomingId = randomUUID();
    const imported = await fetch(`${baseUrl}/api/sync/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookie(ownerId) },
      body: JSON.stringify({
        customers: [{ id: incomingId, name: 'Outra Pessoa', phone: '+55 (11) 96666-5555' }],
        transactions: [],
      }),
    });
    const importedBody = (await imported.json()) as {
      rejected?: { code?: string; message?: string; existingCustomerId?: string }[];
      customersImported?: number;
    };
    expect(imported.status).toBe(200);
    expect(importedBody.customersImported).toBe(0);
    expect(importedBody.rejected?.[0]?.code).toBe('DUPLICATE_PHONE');
    expect(importedBody.rejected?.[0]?.message).toBe('Já existe Lucia Ferreira com esse número');
    expect(importedBody.rejected?.[0]?.existingCustomerId).toBe(createdBody.customer?.id);

    const count = await query(
      `SELECT COUNT(*)::int AS total FROM customers WHERE owner_user_id = $1`,
      [ownerId],
    );
    expect(count.rows[0].total).toBe(1);
    const written = logs.join('\n');
    expect(written).not.toContain('Lucia Ferreira');
    expect(written).not.toContain('96666');
    spy.mockRestore();
  });

  it('nome igual com celular diferente é aceito', async () => {
    const ownerId = await userOf();
    const first = await postCustomer(ownerId, { name: 'Ana Costa', phone: '21911112222' });
    expect(first.status).toBe(201);
    const second = await postCustomer(ownerId, { name: 'Ana Costa', phone: '21933334444' });
    expect(second.status).toBe(201);
  });

  it('quem não é o dono não vê o cliente do outro', async () => {
    const ownerId = await userOf();
    const created = await postCustomer(ownerId, { name: 'Pedro Lima', phone: '31955556666' });
    const createdBody = (await created.json()) as { customer?: { id?: string } };
    expect(created.status).toBe(201);
    const customerId = createdBody.customer?.id;

    const strangerId = await userOf();
    const byId = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      headers: cookie(strangerId),
    });
    expect(byId.status).toBe(404);

    const list = await fetch(`${baseUrl}/api/customers`, { headers: cookie(strangerId) });
    const listBody = (await list.json()) as { customers?: Array<{ id?: string }> };
    expect(list.status).toBe(200);
    expect(listBody.customers?.some((row) => row.id === customerId)).toBe(false);

    const samePhoneOtherShop = await postCustomer(strangerId, {
      name: 'Loja Vizinha',
      phone: '31955556666',
    });
    expect(samePhoneOtherShop.status).toBe(201);
  });
});
