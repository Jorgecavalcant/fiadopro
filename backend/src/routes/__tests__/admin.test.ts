import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import type { AddressInfo } from 'net';

// Mocks precisam vir antes dos imports que os consomem (vitest faz hoist dos vi.mock).
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

import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'http';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import { signToken } from '../../utils/jwt.js';
import adminRouter from '../admin.js';
import { query } from '../../config/database.js';
import { sendPasswordResetEmail } from '../../services/email.js';
import { resolveOverviewRange } from '../../services/adminOverview.js';

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
    const saved = {
      id: USER_ID,
      email: 'u@x.com',
      full_name: 'Novo Nome',
      phone: null,
      avatar_url: null,
      role: 'user',
      is_active: false,
      created_at: 'x',
      updated_at: 'x',
      block_reason: 'fraude',
      block_note: null,
      legal_hold: false,
      blocked_at: 'x',
    };
    mockedQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('block_note')) return { rows: [saved] };
      if (sql.includes('legal_hold')) {
        return { rows: [{ id: USER_ID, is_active: true, block_reason: null, legal_hold: false, deleted_at: null }] };
      }
      return { rows: [] };
    });

    const res = await fetch(`${baseUrl}/api/admin/users/${USER_ID}`, {
      method: 'PATCH',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false, full_name: 'Novo Nome', block_reason: 'fraude' }),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.user.is_active).toBe(false);
    expect(body.user).not.toHaveProperty('password_hash');
    const audit = mockedQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO admin_audit_log'));
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit?.[1])).not.toContain('u@x.com');
    expect(JSON.stringify(audit?.[1])).not.toContain('Novo Nome');
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

describe('GET/PUT /api/admin/settings/:key — rota removida', () => {
  it('rejeita chave fora da allowlist com 404', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/settings/nao-permitida`, {
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(404);
  });

  it('PUT de chave que existia agora responde 404', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/settings/features`, {
      method: 'PUT',
      headers: { ...withCookie(adminToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { betaAI: true } }),
    });
    expect(res.status).toBe(404);
  });

  it('GET de chave que existia agora responde 404', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/settings/limits`, {
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/reports — rota removida', () => {
  it('months acima do antigo limite agora responde 404', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/reports?months=61`, {
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(404);
  });

  it('o agregado antigo agora responde 404', async () => {
    mockRoleAs('admin');
    const res = await fetch(`${baseUrl}/api/admin/reports`, { headers: withCookie(adminToken) });
    expect(res.status).toBe(404);
  });
});

const OVERVIEW_NUMBERS = {
  usuariosAtivos: 17,
  clientes: 23,
  lancamentos: 41,
  volumeConfirmado: 88.5,
  contasBloqueadas: 3,
  contasEncerradas: 5,
};

function mockOverview(dates?: [string, string], type?: string) {
  mockedQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT role FROM users WHERE id = $1'))
      return { rows: [{ role: 'admin' }] };
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('overview:')) {
      if (dates) {
        for (const date of dates) expect(sql).not.toContain(date);
        expect(params.slice(0, 2)).toEqual(dates);
      }
      const isTransaction =
        sql.includes('overview:lancamentos') || sql.includes('overview:volumeConfirmado');
      if (type && isTransaction) {
        expect(sql).toContain('type = $3');
        expect(sql).not.toContain(type);
        expect(params[2]).toBe(type);
      }
      if (!type && isTransaction) expect(sql).not.toContain('type = $3');
      if (sql.includes('overview:usuariosAtivos'))
        return { rows: [{ total: OVERVIEW_NUMBERS.usuariosAtivos }] };
      if (sql.includes('overview:clientes')) return { rows: [{ total: OVERVIEW_NUMBERS.clientes }] };
      if (sql.includes('overview:lancamentos'))
        return { rows: [{ total: OVERVIEW_NUMBERS.lancamentos }] };
      if (sql.includes('overview:volumeConfirmado'))
        return { rows: [{ total: OVERVIEW_NUMBERS.volumeConfirmado }] };
      if (sql.includes('overview:contasBloqueadas'))
        return { rows: [{ total: OVERVIEW_NUMBERS.contasBloqueadas }] };
      if (sql.includes('overview:contasEncerradas'))
        return { rows: [{ total: OVERVIEW_NUMBERS.contasEncerradas }] };
    }
    if (sql.includes('INSERT INTO admin_audit_log')) return { rows: [] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 0 }] };
    return { rows: [] };
  });
}

function assertOverviewNumbers(body: any) {
  expect(body.usuariosAtivos).toBe(OVERVIEW_NUMBERS.usuariosAtivos);
  expect(body.clientes).toBe(OVERVIEW_NUMBERS.clientes);
  expect(body.lancamentos).toBe(OVERVIEW_NUMBERS.lancamentos);
  expect(body.volumeConfirmado).toBe(OVERVIEW_NUMBERS.volumeConfirmado);
  expect(body.contasBloqueadas).toBe(OVERVIEW_NUMBERS.contasBloqueadas);
  expect(body.contasEncerradas).toBe(OVERVIEW_NUMBERS.contasEncerradas);
}

function assertNoPii(text: string) {
  expect(text.includes('@')).toBe(false);
  expect(text).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  expect(text).not.toMatch(/\(\d{2}\)\s?\d{4,5}-?\d{4}/);
  expect(text).not.toMatch(/\b[1-9]{2}9\d{8}\b/);
}

function pdfContentText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => match[1]);
  return streams
    .map((stream) =>
      [...stream.matchAll(/<([0-9A-Fa-f]+)>/g)]
        .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
        .join(''),
    )
    .join('\n');
}

describe('GET /api/admin/overview', () => {
  it('devolve os seis numeros do intervalo sem colar a data no SQL', async () => {
    const dates: [string, string] = ['2026-04-01', '2026-04-07'];
    mockOverview(dates, 'DEBT');
    const res = await fetch(`${baseUrl}/api/admin/overview?from=2026-04-01&to=2026-04-07&type=DEBT`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    assertOverviewNumbers(body);
    expect(body.from).toBe('2026-04-01');
    expect(body.to).toBe('2026-04-07');
    expect(body.type).toBe('DEBT');
    expect(body.preset).toBeNull();
  });

  it('preset 7 cobre sete dias corridos', async () => {
    const range = resolveOverviewRange({ preset: '7' });
    mockOverview([range.from, range.to]);
    const res = await fetch(`${baseUrl}/api/admin/overview?preset=7`, {
      headers: withCookie(adminToken),
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    assertOverviewNumbers(body);
    expect(body.preset).toBe('7');
    expect(body.from).toBe(range.from);
    expect(body.to).toBe(range.to);
    const span = (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000;
    expect(span).toBe(6);
  });

  it('retorna 403 quando o usuario autenticado nao e admin', async () => {
    mockRoleAs('user');
    const res = await fetch(`${baseUrl}/api/admin/overview?preset=30`, {
      headers: withCookie(userToken),
    });
    const body = await json(res);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/admin/overview/export', () => {
  const dates: [string, string] = ['2026-04-01', '2026-04-07'];

  async function exportFile(format: 'pdf' | 'xlsx', method: 'GET' | 'POST' = 'GET') {
    mockOverview(dates, 'DEBT');
    const res = await fetch(
      `${baseUrl}/api/admin/overview/export?from=2026-04-01&to=2026-04-07&type=DEBT&format=${format}`,
      { method, headers: withCookie(adminToken) },
    );
    const buffer = Buffer.from(await res.arrayBuffer());
    return { res, buffer };
  }

  it('gera pdf com os numeros do filtro e sem dado pessoal', async () => {
    const { res, buffer } = await exportFile('pdf');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="visao-geral.pdf"');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const raw = buffer.toString('latin1');
    const text = pdfContentText(buffer);
    assertNoPii(raw);
    assertNoPii(text);
    expect(text).toContain('usuariosAtivos: 17');
    expect(text).toContain('clientes: 23');
    expect(text).toContain('lancamentos: 41');
    expect(text).toContain('volumeConfirmado: 88.5');
    expect(text).toContain('contasBloqueadas: 3');
    expect(text).toContain('contasEncerradas: 5');
    expect(text).toContain('Periodo: 2026-04-01 a 2026-04-07');
    expect(text).toContain('Tipo: DEBT');

    const audit = mockedQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO admin_audit_log'));
    expect(audit).toBeTruthy();
    expect(audit?.[1]?.[1]).toBe('overview.export');
    const before = JSON.parse(String(audit?.[1]?.[5]));
    const after = JSON.parse(String(audit?.[1]?.[6]));
    expect(before).toEqual({ format: 'pdf', from: '2026-04-01', to: '2026-04-07', type: 'DEBT' });
    expect(after).toEqual(before);
  });

  it('gera xlsx com os numeros do filtro e sem dado pessoal', async () => {
    const { res, buffer } = await exportFile('xlsx', 'POST');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="visao-geral.xlsx"');
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
    const text = buffer.toString('latin1');
    assertNoPii(text);
    expect(text).toContain('usuariosAtivos: 17');
    expect(text).toContain('clientes: 23');
    expect(text).toContain('lancamentos: 41');
    expect(text).toContain('volumeConfirmado: 88.5');
    expect(text).toContain('contasBloqueadas: 3');
    expect(text).toContain('contasEncerradas: 5');
  });
});

describe('GET /api/admin/audit — overview.export', () => {
  it('aceita overview.export na allowlist', async () => {
    mockedQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT role FROM users WHERE id = $1'))
        return { rows: [{ role: 'admin' }] };
      if (sql.includes('COUNT(*)')) return { rows: [{ total: 0 }] };
      if (sql.includes('admin_audit_log')) {
        expect(params).toContain('overview.export');
        return { rows: [] };
      }
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/admin/audit?action=overview.export`, {
      headers: withCookie(adminToken),
    });
    expect(res.status).toBe(200);
  });
});
