import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import type { AddressInfo } from 'net';

// Mocks precisam vir antes dos imports que os consomem (vitest faz hoist dos vi.mock).
vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import { signToken } from '../../utils/jwt.js';
import adminRouter from '../admin.js';
import { query } from '../../config/database.js';
import { sendPasswordResetEmail } from '../../services/email.js';

const mockedQuery = query as unknown as ReturnType<typeof vi.fn>;
const mockedSendResetEmail = sendPasswordResetEmail as unknown as ReturnType<typeof vi.fn>;

// App de teste isolado — sem rate limiter, sem conexao real com Postgres.
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

/** fetch().json() vem tipado como unknown neste ambiente; helper local so para os testes. */
async function json(res: Response): Promise<any> {
  return res.json();
}

/** Roteia as respostas mockadas do query() por trecho reconhecivel do SQL. */
function mockRoleAs(role: string | null) {
  mockedQuery.mockImplementation(async (sql: string, _params: unknown[] = []) => {
    if (sql.includes('SELECT role FROM users WHERE id = $1')) {
      return { rows: role === null ? [] : [{ role }] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  mockedQuery.mockReset();
  mockedSendResetEmail.mockClear();
});

describe('middleware requireAuth/requireAdmin em /api/admin/*', () => {
  it('retorna 401 quando nao ha cookie de sessao', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`);
    expect(res.status).toBe(401);
  });

  it('retorna 403 quando o usuario autenticado nao e admin', async () => {
    mockRoleAs('user');
    const res = await fetch(`${baseUrl}/api/admin/users`, { headers: withCookie(userToken) });
    const body = await json(res);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/admin/users', () => {
  it('pagina corretamente e nunca expoe password_hash', async () => {
    mockedQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1')) {
        return { rows: [{ role: 'admin' }] };
      }
      if (sql.includes('COUNT(*)::int AS total FROM users')) {
        return { rows: [{ total: 45 }] };
      }
      if (sql.includes('FROM users') && sql.includes('ORDER BY created_at DESC')) {
        // Confere que a paginacao (LIMIT/OFFSET) chegou calculada corretamente.
        expect(params).toContain(10); // limit
        expect(params).toContain(10); // offset = (page-1)*limit = (2-1)*10
        return {
          rows: [
            {
              id: 'u1',
              email: 'a@b.com',
              full_name: 'A',
              phone: null,
              avatar_url: null,
              role: 'user',
              is_active: true,
              created_at: 'x',
              updated_at: 'x',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await fetch(`${baseUrl}/api/admin/users?page=2&limit=10`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.meta).toEqual({ total: 45, page: 2, limit: 10, totalPages: 5 });
    expect(body.users).toHaveLength(1);
    for (const u of body.users) {
      expect(u).not.toHaveProperty('password_hash');
    }
  });

  it('aplica busca (search) construindo ILIKE sobre nome/email', async () => {
    mockedQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('COUNT(*)::int AS total FROM users')) {
        expect(sql).toContain('ILIKE');
        expect(params).toEqual(['%joao%']);
        return { rows: [{ total: 0 }] };
      }
      return { rows: [] };
    });

    const res = await fetch(`${baseUrl}/api/admin/users?search=joao`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.meta.total).toBe(0);
  });
});

describe('PATCH /api/admin/users/:id', () => {
  it('proibe alterar role por essa rota', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}`, {
      method: 'PATCH',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('ROLE_CHANGE_FORBIDDEN');
  });

  it('atualiza is_active/full_name/phone quando payload e valido', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.startsWith('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL'))
        return { rows: [{ id: USER_ID }] };
      if (sql.startsWith('UPDATE users SET')) {
        return {
          rows: [
            {
              id: USER_ID,
              email: 'u@x.com',
              full_name: 'Novo Nome',
              phone: null,
              avatar_url: null,
              role: 'user',
              is_active: false,
              created_at: 'x',
              updated_at: 'x',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}`, {
      method: 'PATCH',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false, full_name: 'Novo Nome' }),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.user.is_active).toBe(false);
    expect(body.user).not.toHaveProperty('password_hash');
  });

  it('retorna 404 quando usuario nao existe', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.startsWith('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL'))
        return { rows: [] };
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}`, {
      method: 'PATCH',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Nome Valido' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/users/:id/reset-password', () => {
  it('gera token e envia e-mail no padrao do forgot-password', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('SELECT id, email FROM users WHERE id = $1'))
        return { rows: [{ id: USER_ID, email: 'u@x.com' }] };
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}/reset-password`, {
      method: 'POST',
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockedSendResetEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendResetEmail.mock.calls[0][0]).toBe('u@x.com');
  });

  it('retorna 404 se usuario nao existe ou esta inativo', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('SELECT id, email FROM users WHERE id = $1')) return { rows: [] };
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}/reset-password`, {
      method: 'POST',
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(404);
    expect(mockedSendResetEmail).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/metrics', () => {
  it('agrega contagens e volume mensal para admin', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('FROM users WHERE is_active = true')) return { rows: [{ total: 7 }] };
      if (sql.includes('FROM customers')) return { rows: [{ total: 3 }] };
      if (sql.includes('FROM transactions') && sql.includes('COUNT(*)::int AS total'))
        return { rows: [{ total: 100 }] };
      if (sql.includes('date_trunc'))
        return { rows: [{ month: '2026-07', volume: '500.00', count: 4 }] };
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/metrics`, { headers: withCookie(adminToken) });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.metrics.activeUsers).toBe(7);
    expect(body.metrics.customers).toBe(3);
    expect(body.metrics.transactions).toBe(100);
    expect(body.metrics.monthlyVolume).toEqual([{ month: '2026-07', volume: '500.00', count: 4 }]);
  });
});

describe('GET/PUT /api/admin/settings/:key — allowlist', () => {
  it('rejeita chave fora da allowlist com 400', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/settings/nao-permitida`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('aceita chave da allowlist e faz upsert', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('INSERT INTO app_settings')) {
        return { rows: [{ key: 'features', value: { betaAI: true }, updated_at: 'x' }] };
      }
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/settings/features`, {
      method: 'PUT',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { betaAI: true } }),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.key).toBe('features');
    expect(body.value).toEqual({ betaAI: true });
  });

  it('GET de chave inexistente retorna value:null sem erro', async () => {
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('SELECT value, updated_at FROM app_settings')) return { rows: [] };
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/settings/limits`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.value).toBeNull();
  });
});

describe('GET /api/admin/reports', () => {
  it('limita months a 60 e rejeita valores maiores', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/reports?months=61`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('retorna agregado por mes/tipo dentro do limite', async () => {
    mockedQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('FROM transactions')) {
        expect(params).toEqual([12]);
        return { rows: [{ month: '2026-07', type: 'DEBT', total: '120.00', count: 2 }] };
      }
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/reports`, { headers: withCookie(adminToken) });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.months).toBe(12);
    expect(body.report).toEqual([{ month: '2026-07', type: 'DEBT', total: '120.00', count: 2 }]);
  });
});
