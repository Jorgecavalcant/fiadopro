import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// -----------------------------------------------------------------
// Mocks (hoisted) — banco de dados fake em memoria + google-auth-library
// -----------------------------------------------------------------
const { mockQuery, mockVerifyIdToken } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockVerifyIdToken: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  query: mockQuery,
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// A frente CORE (vínculo+aprovação) adicionou chamadas a este serviço no
// register/google — mockado aqui pois este arquivo testa só a normalização
// de e-mail, não o comportamento de vínculo (que tem testes próprios).
vi.mock('../services/linking.js', () => ({
  relinkCustomersForUser: vi.fn(),
  ensureAdminRole: vi.fn(),
}));

// Importado depois dos mocks (ESM hoisting do vi.mock garante a ordem correta)
import router from './auth.js';

// -----------------------------------------------------------------
// Fake DB — interpreta as queries literais usadas em auth.ts e
// mantem um array de usuarios em memoria (sem banco real).
// -----------------------------------------------------------------
interface FakeUser {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  is_active: boolean;
  google_id: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
}

function createFakeDb() {
  const users: FakeUser[] = [];
  let idCounter = 1;

  const query = async (sqlRaw: string, params: unknown[] = []) => {
    const sql = sqlRaw.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('SELECT id FROM users WHERE email = $1')) {
      const [email] = params as [string];
      return { rows: users.filter((u) => u.email === email).map((u) => ({ id: u.id })) };
    }

    if (
      sql.startsWith(
        'SELECT id, email, full_name, password_hash, is_active, role FROM users WHERE email = $1',
      )
    ) {
      const [email] = params as [string];
      return { rows: users.filter((u) => u.email === email) };
    }

    if (
      sql.startsWith('INSERT INTO users (full_name, email, password_hash, consent_at, consent_ip)')
    ) {
      const [full_name, email, password_hash] = params as [string, string, string];
      const user: FakeUser = {
        id: String(idCounter++),
        full_name,
        email,
        password_hash,
        is_active: true,
        google_id: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        role: 'user',
      };
      users.push(user);
      return {
        rows: [
          {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            created_at: user.created_at,
          },
        ],
      };
    }

    if (
      sql.startsWith(
        'SELECT id, email, full_name, is_active, role FROM users WHERE google_id = $1 OR email = $2',
      )
    ) {
      const [google_id, email] = params as [string, string];
      return { rows: users.filter((u) => u.google_id === google_id || u.email === email) };
    }

    if (sql.startsWith('INSERT INTO users (email, full_name, avatar_url, google_id)')) {
      const [email, full_name, avatar_url, google_id] = params as [
        string,
        string,
        string | null,
        string,
      ];
      const user: FakeUser = {
        id: String(idCounter++),
        email,
        full_name,
        avatar_url,
        google_id,
        password_hash: null,
        is_active: true,
        created_at: new Date().toISOString(),
        role: 'user',
      };
      users.push(user);
      return { rows: [{ id: user.id, email: user.email, full_name: user.full_name }] };
    }

    if (sql.startsWith('UPDATE users SET google_id = $1')) {
      const [google_id, avatar_url, id] = params as [string, string | null, string];
      const user = users.find((u) => u.id === id);
      if (user) {
        user.google_id = google_id;
        user.avatar_url = user.avatar_url ?? avatar_url;
      }
      return { rows: [] };
    }

    if (sql.startsWith('SELECT role FROM users WHERE id = $1')) {
      const [id] = params as [string];
      const user = users.find((u) => u.id === id);
      return { rows: user ? [{ role: user.role }] : [] };
    }

    throw new Error(`Query nao tratada no fake db: ${sql}`);
  };

  return { users, query };
}

// -----------------------------------------------------------------
// Helpers para invocar o handler de uma rota do Express Router
// diretamente, sem subir um servidor HTTP real.
// -----------------------------------------------------------------

function getRouteHandler(method: 'get' | 'post', path: string): any {
  const layer = (router as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`Rota nao encontrada: ${method.toUpperCase()} ${path}`);
  const routeLayer = layer.route.stack[layer.route.stack.length - 1];
  return routeLayer.handle;
}

function createRes() {
  const res: Partial<Response> & {
    body?: unknown;
    statusCode: number;
    cookies: Record<string, unknown>;
  } = {
    statusCode: 200,
    cookies: {},
  };
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response['status'];
  res.json = ((payload: unknown) => {
    res.body = payload;
    return res;
  }) as Response['json'];
  res.cookie = ((name: string, value: string, opts: unknown) => {
    res.cookies[name] = { value, opts };
    return res;
  }) as unknown as Response['cookie'];
  res.clearCookie = (() => res) as unknown as Response['clearCookie'];
  return res as Response & { body?: any; statusCode: number; cookies: Record<string, unknown> };
}

function createReq(body: Record<string, unknown>): Request {
  return { body, headers: {}, ip: '127.0.0.1' } as unknown as Request;
}

describe('normalizacao de e-mail em auth.ts (dedup auth)', () => {
  let fakeDb: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    fakeDb = createFakeDb();
    mockQuery.mockReset();
    mockQuery.mockImplementation(fakeDb.query);
    mockVerifyIdToken.mockReset();
  });

  it('registra com e-mail em maiusculas e depois faz login com o mesmo e-mail em minusculas, resolvendo para o mesmo usuario', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const loginHandler = getRouteHandler('post', '/login');

    const registerReq = createReq({
      full_name: 'Jorge Teste',
      email: 'Jorge@Gmail.com',
      password: 'Senha123',
      consent: true,
    });
    const registerRes = createRes();
    const next = vi.fn();

    await registerHandler(registerReq, registerRes, next);

    expect(next).not.toHaveBeenCalled();
    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body.user.email).toBe('jorge@gmail.com');
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.users[0].email).toBe('jorge@gmail.com');

    const registeredUserId = registerRes.body.user.id;

    const loginReq = createReq({
      email: '  JORGE@gmail.COM  ',
      password: 'Senha123',
    });
    const loginRes = createRes();
    const loginNext = vi.fn();

    await loginHandler(loginReq, loginRes, loginNext);

    expect(loginNext).not.toHaveBeenCalled();
    expect(loginRes.statusCode ?? 200).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.user.id).toBe(registeredUserId);
    expect(loginRes.body.user.email).toBe('jorge@gmail.com');
    expect(fakeDb.users).toHaveLength(1);
  });

  it('login via Google com e-mail em capitalizacao diferente de um cadastro manual existente atualiza o registro existente (vincula google_id) em vez de criar um novo', async () => {
    // Simula um usuario ja cadastrado manualmente (email normalizado, como fica apos o fix)
    fakeDb.users.push({
      id: 'user-manual-1',
      email: 'jorge@gmail.com',
      full_name: 'Jorge Teste',
      password_hash: 'hash-fake',
      is_active: true,
      google_id: null,
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: 'user',
    });

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'Jorge@Gmail.com',
        name: 'Jorge Teste',
        picture: 'https://example.com/avatar.png',
      }),
    });

    const googleHandler = getRouteHandler('post', '/google');
    const req = createReq({ id_token: 'fake-id-token' });
    const res = createRes();
    const next = vi.fn();

    await googleHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe('user-manual-1');
    expect(res.body.user.email).toBe('jorge@gmail.com');

    // Nao deve ter criado um segundo usuario
    expect(fakeDb.users).toHaveLength(1);
    // Deve ter vinculado o google_id ao usuario existente
    expect(fakeDb.users[0].google_id).toBe('google-sub-123');
  });

  it('forgot-password com e-mail nao-string retorna 400 controlado em vez de vazar erro interno 500', async () => {
    const forgotHandler = getRouteHandler('post', '/forgot-password');
    const req = createReq({ email: 12345 });
    const res = createRes();
    const next = vi.fn();

    await forgotHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('MISSING_EMAIL');
  });
});
