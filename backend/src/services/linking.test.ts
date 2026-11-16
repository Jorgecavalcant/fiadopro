vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../config/database.js';
import { ensureAdminRole, linkCustomer, relinkCustomersForUser } from './linking.js';

const mockQuery = vi.mocked(query);

const rows = (data: unknown[]) => ({ rows: data, rowCount: data.length });

beforeEach(() => {
  mockQuery.mockReset();
  delete process.env.ADMIN_EMAIL;
});

describe('linkCustomer', () => {
  it('links a customer by email', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{
        id: 'c1',
        owner_user_id: 'owner',
        email: 'a@example.com',
        phone: null,
        linked_user_id: null,
      }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-1');
  });

  it('includes an owner guard when updating the customer link', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{
        id: 'c1',
        owner_user_id: 'owner',
        email: 'a@example.com',
        phone: null,
        linked_user_id: null,
      }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await linkCustomer('c1');

    expect(mockQuery.mock.calls.some(([sql]) => /owner_user_id/i.test(String(sql)))).toBe(true);
  });
});

describe('relinkCustomersForUser', () => {
  it('relinks candidate customers and returns the number linked', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ id: 'c1' }]) as never)
      .mockResolvedValueOnce(rows([{ email: 'a@example.com', phone: null }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'c9' }]) as never)
      .mockResolvedValueOnce(rows([{
        id: 'c9',
        owner_user_id: 'owner',
        email: 'a@example.com',
        phone: null,
        linked_user_id: null,
      }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(relinkCustomersForUser('user-1')).resolves.toBe(1);
    expect(mockQuery).toHaveBeenCalledTimes(6);
  });
});

describe('ensureAdminRole', () => {
  it('does nothing when ADMIN_EMAIL is not configured', async () => {
    await ensureAdminRole();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('demotes the matching user role before promoting the admin role', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    mockQuery
      .mockResolvedValueOnce(rows([]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await ensureAdminRole();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(String(mockQuery.mock.calls[0][0])).toMatch(/role\s*=\s*\$1/i);
    expect(String(mockQuery.mock.calls[1][0])).toMatch(/role\s*=\s*\$1/i);
  });
});
