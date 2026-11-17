import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  query: mockQuery,
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

vi.mock('../services/linking.js', () => ({
  relinkCustomersForUser: vi.fn(),
  ensureAdminRole: vi.fn(),
}));

import router from './auth.js';
import type { AuthRequest } from '../middleware/auth.js';

function getMeHandler() {
  const layer = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }> }).stack.find(
    (l) => l.route && l.route.path === '/me' && l.route.methods.get,
  );
  if (!layer?.route) throw new Error('GET /me nao encontrada');
  return layer.route.stack[layer.route.stack.length - 1].handle as (
    req: AuthRequest,
    res: Response,
    next: (err?: unknown) => void,
  ) => Promise<void>;
}

function createRes() {
  const res: Partial<Response> & { body?: unknown; statusCode: number } = { statusCode: 200 };
  res.status = ((code: number) => {
    res.statusCode = code;
    return res;
  }) as Response['status'];
  res.json = ((payload: unknown) => {
    res.body = payload;
    return res;
  }) as Response['json'];
  return res as Response & { body?: { success?: boolean; dataEpoch?: string | null; user?: { id: string } }; statusCode: number };
}

describe('GET /api/auth/me — dataEpoch', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('inclui dataEpoch de app_settings sem expor outros segredos', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u1',
            email: 'jorge@example.com',
            full_name: 'Jorge',
            phone: null,
            pix_key: null,
            avatar_url: null,
            role: 'admin',
            created_at: '2026-01-01T00:00:00.000Z',
            has_password: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ value: '2026-11-17T09:12:00Z' }] });

    const handler = getMeHandler();
    const req = { user: { sub: 'u1' } } as AuthRequest;
    const res = createRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.body?.success).toBe(true);
    expect(res.body?.user?.id).toBe('u1');
    expect(res.body?.dataEpoch).toBe('2026-11-17T09:12:00Z');
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|secret|token/i);
    expect(mockQuery.mock.calls[1][0]).toContain('app_settings');
    expect(mockQuery.mock.calls[1][0]).toContain('data_epoch');
  });

  it('devolve dataEpoch null quando a chave nao existe', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u1',
            email: 'jorge@example.com',
            full_name: 'Jorge',
            phone: null,
            pix_key: null,
            avatar_url: null,
            role: 'user',
            created_at: '2026-01-01T00:00:00.000Z',
            has_password: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const handler = getMeHandler();
    const res = createRes();
    await handler({ user: { sub: 'u1' } } as AuthRequest, res, vi.fn());

    expect(res.body?.dataEpoch).toBeNull();
  });
});
