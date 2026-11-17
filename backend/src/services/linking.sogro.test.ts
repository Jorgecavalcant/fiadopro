vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../config/database.js';
import { ensureAdminRole, linkCustomer } from './linking.js';

const mockQuery = vi.mocked(query);
const rows = (data: unknown[]) => ({ rows: data, rowCount: data.length });

beforeEach(() => {
  mockQuery.mockReset();
});

describe('linkCustomer sogro scenarios', () => {
  it('links a customer by email', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'sogro@example.com',
            phone: null,
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-sogro' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-sogro');
  });

  it('queues a review when email and phone match different users', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'person@example.com',
            phone: '62999991234',
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-email' }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-phone', phone: '62999991234' }]) as never)
      .mockResolvedValueOnce(rows([]) as never) // review insert
      .mockResolvedValueOnce(rows([]) as never); // unlink

    await expect(linkCustomer('c1')).resolves.toBeNull();
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('link_review_queue'))).toBe(
      true,
    );
  });

  it('links a phone match even when phone_verified_at is absent (no longer required)', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: null,
            phone: '62999991234',
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-phone', phone: '62999991234' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-phone');
  });

  it('links via 9th-digit equivalence', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: null,
            phone: '6299991234',
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-phone', phone: '62999991234' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-phone');
  });

  it('prefers phone match over a different email-only match when email points elsewhere → conflict', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'other@example.com',
            phone: '62999991234',
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-email' }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-phone', phone: '62999991234' }]) as never)
      .mockResolvedValueOnce(rows([]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBeNull();
  });
});

describe('ensureAdminRole', () => {
  it('demotes other admins then promotes ADMIN_EMAIL', async () => {
    const previousAdminEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = 'admin@example.com';
    mockQuery.mockResolvedValueOnce(rows([]) as never).mockResolvedValueOnce(rows([]) as never);
    try {
      await ensureAdminRole();
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(String(mockQuery.mock.calls[0][0])).toMatch(/role\s*=\s*\$1/i);
      expect(String(mockQuery.mock.calls[1][0])).toMatch(/role\s*=\s*\$1/i);
    } finally {
      if (previousAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousAdminEmail;
    }
  });
});
