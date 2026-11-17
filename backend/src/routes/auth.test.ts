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
  phone: string | null;
  is_active: boolean;
  google_id: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
  deleted_at?: string | null;
  purge_completed_at?: string | null;
  purge_after?: string | null;
  login_retained?: boolean;
  legal_hold?: boolean;
}

function createFakeDb() {
  const users: FakeUser[] = [];
  let idCounter = 1;

  const query = async (sqlRaw: string, params: unknown[] = []) => {
    const sql = sqlRaw.replace(/\s+/g, ' ').trim();

    if (
      sql.startsWith('SELECT id, email, full_name, password_hash, is_active, role') &&
      sql.includes('WHERE email = $1') &&
      !sql.includes('google_id')
    ) {
      const [email] = params as [string];
      return { rows: users.filter((u) => u.email === email) };
    }

    if (
      sql.startsWith('INSERT INTO users (full_name, email, password_hash') &&
      sql.includes('RETURNING id, email, full_name')
    ) {
      const hasPhone = /\bphone\b/.test(sql);
      const [full_name, email, password_hash] = params as [string, string, string];
      const phone = hasPhone ? ((params[3] as string | null) ?? null) : null;
      const user: FakeUser = {
        id: String(idCounter++),
        full_name,
        email,
        password_hash,
        phone,
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
            phone: user.phone,
            created_at: user.created_at,
          },
        ],
      };
    }

    if (sql.startsWith('SELECT phone FROM users WHERE id = $1')) {
      const [id] = params as [string];
      const user = users.find((u) => u.id === id);
      return { rows: user ? [{ phone: user.phone }] : [] };
    }

    if (
      sql.includes('SELECT id, email, full_name') &&
      sql.includes('(password_hash IS NOT NULL) AS has_password') &&
      sql.includes('WHERE google_id = $1 OR email = $2')
    ) {
      const [google_id, email] = params as [string, string];
      return {
        rows: users
          .filter((u) => u.google_id === google_id || u.email === email)
          .map((u) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            phone: u.phone,
            is_active: u.is_active,
            role: u.role,
            has_password: u.password_hash !== null,
            google_id: u.google_id,
            avatar_url: u.avatar_url,
            created_at: u.created_at,
            deleted_at: u.deleted_at ?? null,
            purge_completed_at: u.purge_completed_at ?? null,
            purge_after: u.purge_after ?? null,
            login_retained: u.login_retained ?? false,
            legal_hold: u.legal_hold ?? false,
          })),
      };
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
        phone: null,
        is_active: true,
        created_at: new Date().toISOString(),
        role: 'user',
      };
      users.push(user);
      return {
        rows: [
          { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone },
        ],
      };
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

const VALID_PHONE = '62999991234';

describe('normalizacao de e-mail em auth.ts (dedup auth)', () => {
  let fakeDb: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    delete process.env.REQUIRE_EMAIL_CONFIRMATION;
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
      phone: VALID_PHONE,
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
    fakeDb.users.push({
      id: 'user-manual-1',
      email: 'jorge@gmail.com',
      full_name: 'Jorge Teste',
      password_hash: 'hash-fake',
      phone: null,
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

    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.users[0].google_id).toBe('google-sub-123');
  });

  it('não reativa conta encerrada quando o e-mail do Google é de outra pessoa', async () => {
    fakeDb.users.push({
      id: 'conta-fechada',
      email: 'vitima@example.test',
      full_name: 'Vitima',
      password_hash: null,
      phone: null,
      is_active: false,
      google_id: 'sub-do-google',
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: 'user',
      deleted_at: new Date().toISOString(),
      purge_completed_at: null,
      purge_after: new Date(Date.now() + 10 * 86400000).toISOString(),
      login_retained: true,
      legal_hold: false,
    });

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'sub-do-google',
        email: 'outra-pessoa@example.test',
        name: 'Outra',
      }),
    });

    const googleHandler = getRouteHandler('post', '/google');
    const req = createReq({ id_token: 'fake-id-token', reactivate: true });
    const res = createRes();
    const next = vi.fn();

    await googleHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe('ACCOUNT_DISABLED');
    expect(res.cookies.fiado_token).toBeUndefined();
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.users[0].deleted_at).toBeTruthy();
    expect(fakeDb.users[0].email).toBe('vitima@example.test');
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

describe('telefone em auth.ts (cadastro e completude)', () => {
  let fakeDb: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    delete process.env.REQUIRE_EMAIL_CONFIRMATION;
    fakeDb = createFakeDb();
    mockQuery.mockReset();
    mockQuery.mockImplementation(fakeDb.query);
    mockVerifyIdToken.mockReset();
  });

  it('register sem phone retorna 400 de validacao e nao cria usuario', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const req = createReq({
      full_name: 'Sem Telefone',
      email: 'sem.phone@gmail.com',
      password: 'Senha123',
      consent: true,
    });
    const res = createRes();
    const next = vi.fn();

    await registerHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(['VALIDATION_ERROR', 'INVALID_PHONE']).toContain(err.code);
    expect(fakeDb.users).toHaveLength(0);
  });

  it('register com phone invalido retorna 400 e nao cria usuario', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const req = createReq({
      full_name: 'Telefone Ruim',
      email: 'phone.ruim@gmail.com',
      password: 'Senha123',
      phone: '123',
      consent: true,
    });
    const res = createRes();
    const next = vi.fn();

    await registerHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('INVALID_PHONE');
    expect(fakeDb.users).toHaveLength(0);
  });

  it('register com phone valido retorna 201 e persiste o phone normalizado', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const req = createReq({
      full_name: 'Com Telefone',
      email: 'com.phone@gmail.com',
      password: 'Senha123',
      phone: '(62) 99999-1234',
      consent: true,
    });
    const res = createRes();
    const next = vi.fn();

    await registerHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.needs_phone_completion).toBe(false);
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.users[0].phone).toMatch(/^\+?(55)?62999991234$/);
  });

  it('login de usuario sem phone sinaliza needs_phone_completion true', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const loginHandler = getRouteHandler('post', '/login');

    const registerRes = createRes();
    await registerHandler(
      createReq({
        full_name: 'Sem Phone Depois',
        email: 'sem.phone.depois@gmail.com',
        password: 'Senha123',
        phone: VALID_PHONE,
        consent: true,
      }),
      registerRes,
      vi.fn(),
    );
    expect(registerRes.statusCode).toBe(201);
    fakeDb.users[0].phone = null;

    const loginRes = createRes();
    const loginNext = vi.fn();
    await loginHandler(
      createReq({ email: 'sem.phone.depois@gmail.com', password: 'Senha123' }),
      loginRes,
      loginNext,
    );

    expect(loginNext).not.toHaveBeenCalled();
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.needs_phone_completion).toBe(true);
    expect(loginRes.body.user.needs_phone_completion).toBe(true);
  });

  it('login de usuario com phone de 11 digitos sinaliza needs_phone_completion false', async () => {
    const registerHandler = getRouteHandler('post', '/register');
    const loginHandler = getRouteHandler('post', '/login');

    const registerRes = createRes();
    await registerHandler(
      createReq({
        full_name: 'Com Phone Onze',
        email: 'com.phone.onze@gmail.com',
        password: 'Senha123',
        phone: VALID_PHONE,
        consent: true,
      }),
      registerRes,
      vi.fn(),
    );
    expect(registerRes.statusCode).toBe(201);
    fakeDb.users[0].phone = VALID_PHONE;

    const loginRes = createRes();
    const loginNext = vi.fn();
    await loginHandler(
      createReq({ email: 'com.phone.onze@gmail.com', password: 'Senha123' }),
      loginRes,
      loginNext,
    );

    expect(loginNext).not.toHaveBeenCalled();
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.needs_phone_completion).toBe(false);
    expect(loginRes.body.user.needs_phone_completion).toBe(false);
  });

  it('login via Google de usuario novo sinaliza needs_phone_completion true', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-novo',
        email: 'novo.google@gmail.com',
        name: 'Novo Google',
      }),
    });

    const googleHandler = getRouteHandler('post', '/google');
    const req = createReq({ id_token: 'fake-id-token' });
    const res = createRes();
    const next = vi.fn();

    await googleHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body.success).toBe(true);
    expect(res.body.needs_phone_completion).toBe(true);
    expect(res.body.user.needs_phone_completion).toBe(true);
    expect(fakeDb.users).toHaveLength(1);
    expect(fakeDb.users[0].phone ?? null).toBeNull();
  });
});
