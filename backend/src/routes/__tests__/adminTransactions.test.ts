import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import type { AddressInfo } from 'net';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import { signToken } from '../../utils/jwt.js';
import adminRouter from '../admin.js';
import { query } from '../../config/database.js';

const { queryMock, getClientMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const getClientMock = vi.fn(async () => ({
    query: queryMock,
    release() {},
  }));
  return { queryMock, getClientMock };
});

vi.mock('../../config/database.js', () => ({
  query: queryMock,
  getClient: getClientMock,
}));

vi.mock('../../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockedQuery = query as unknown as ReturnType<typeof vi.fn>;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', adminRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const adminToken = signToken({ sub: ADMIN_ID, email: 'admin@fiadopro.com' });
const userToken = signToken({ sub: USER_ID, email: 'user@fiadopro.com' });

function withCookie(token: string) {
  return { Cookie: `fiado_token=${token}` };
}

function mockRoleAs(role: string | null) {
  mockedQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT role FROM users WHERE id = $1')) {
      return { rows: role === null ? [] : [{ role }] };
    }
    if (sql.includes('COUNT(*)') && sql.includes('FROM transactions')) {
      return { rows: [{ total: 1 }] };
    }
    if (sql.includes('FROM transactions t')) {
      return {
        rows: [
          {
            id: 'tx1',
            type: 'DEBT',
            status: 'PENDING',
            amount: 10,
            created_at: '2026-01-01T00:00:00.000Z',
            description: 'teste',
            owner_name: 'Dono',
            customer_name: 'Cliente',
            linked_user_name: null,
          },
        ],
      };
    }
    return { rows: [] };
  });
}

describe('GET /api/admin/transactions', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('returns paginated transactions for admin without phone/cpf/pix', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/transactions?page=1&limit=20`, {
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      transactions: unknown[];
      meta: { total: number };
    };
    expect(body.success).toBe(true);
    expect(body.transactions).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    const sql = mockedQuery.mock.calls.map((c) => String(c[0])).join('\n');
    expect(sql).toMatch(/FROM transactions t/i);
    expect(sql.toLowerCase()).not.toMatch(/\bphone\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bcpf\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bpix\b/);
  });

  it('forbids non-admin', async () => {
    mockRoleAs('user');
    const res = await fetch(`${baseUrl}/api/admin/transactions`, {
      headers: withCookie(userToken),
    });
    expect(res.status).toBe(403);
  });
});
