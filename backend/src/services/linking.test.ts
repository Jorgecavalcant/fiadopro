import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import { query } from '../config/database.js';
import { linkCustomer, relinkCustomersForUser, ensureAdminRole } from './linking.js';

const mockQuery = vi.mocked(query);

describe('linkCustomer', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('retorna o linked_user_id quando o UPDATE encontra usuário que bate', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ linked_user_id: 'user-dyllan' }], rowCount: 1 } as never);
    const result = await linkCustomer('customer-1');
    expect(result).toBe('user-dyllan');
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(['customer-1']);
  });

  it('sem match: retorna null e executa a limpeza de vínculo obsoleto', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await linkCustomer('customer-2');
    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(String(mockQuery.mock.calls[1][0])).toContain('linked_user_id = NULL');
  });

  it('nunca vincula o cliente ao próprio dono (guarda no SQL)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await linkCustomer('customer-3');
    expect(String(mockQuery.mock.calls[0][0])).toContain('u.id <> c.owner_user_id');
  });
});

describe('relinkCustomersForUser', () => {
  beforeEach(() => { mockQuery.mockReset(); });

  it('desfaz vínculos que não batem mais e cria os novos, retornando a contagem', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 } as never); // unlink
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], rowCount: 3 } as never);
    const count = await relinkCustomersForUser('user-1');
    expect(count).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(String(mockQuery.mock.calls[1][0])).toContain('c.owner_user_id <> $1');
  });
});

describe('ensureAdminRole', () => {
  const oldEnv = process.env.ADMIN_EMAIL;
  beforeEach(() => { mockQuery.mockReset(); });
  afterEach(() => {
    process.env.ADMIN_EMAIL = oldEnv;
  });

  it('sem ADMIN_EMAIL definido, não toca no banco', async () => {
    delete process.env.ADMIN_EMAIL;
    await ensureAdminRole();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('com ADMIN_EMAIL, promove por e-mail (case-insensitive)', async () => {
    process.env.ADMIN_EMAIL = 'jorge@exemplo.com';
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await ensureAdminRole();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(String(mockQuery.mock.calls[0][0])).toContain("role = 'admin'");
    expect(mockQuery.mock.calls[0][1]).toEqual(['jorge@exemplo.com']);
  });

  it('erro de banco não propaga (bootstrap é best-effort)', async () => {
    process.env.ADMIN_EMAIL = 'jorge@exemplo.com';
    mockQuery.mockRejectedValueOnce(new Error('db off') as never);
    await expect(ensureAdminRole()).resolves.toBeUndefined();
  });
});
