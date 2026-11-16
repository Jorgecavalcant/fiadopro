import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('../../config/database.js', () => ({
  query: queryMock,
  getClient: vi.fn(),
}));

import { requireAdmin } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/errorHandler.js';

describe('requireAdmin', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns 403 FORBIDDEN for a non-admin user', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: 'user' }] });
    const req = { user: { sub: 'u1', email: 'u@example.com' } } as never;
    const next = vi.fn();
    await requireAdmin(req, {} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('allows admin role', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
    const req = { user: { sub: 'u1', email: 'admin@example.com' } } as never;
    const next = vi.fn();
    await requireAdmin(req, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
});
