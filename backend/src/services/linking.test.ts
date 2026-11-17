vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../config/database.js';
import {
  ensureAdminRole,
  linkCustomer,
  linkFeedback,
  relinkCustomersForUser,
} from './linking.js';

const mockQuery = vi.mocked(query);

const rows = (data: unknown[]) => ({ rows: data, rowCount: data.length });

beforeEach(() => {
  mockQuery.mockReset();
  delete process.env.ADMIN_EMAIL;
});

describe('linkFeedback', () => {
  it('messages for linked and unlinked', () => {
    expect(linkFeedback('u1')).toEqual({
      linked: true,
      message: 'Conta encontrada e vinculada',
    });
    expect(linkFeedback(null).linked).toBe(false);
    expect(linkFeedback(null).message).toMatch(/ainda não tem conta/i);
  });
});

describe('linkCustomer', () => {
  it('links a customer by email when there is no phone match', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'a@example.com',
            phone: null,
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-1');
  });

  it('links by phone without requiring phone_verified_at', async () => {
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

  it('prefers phone over email when both match the same user', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'a@example.com',
            phone: '62999991234',
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([{ id: 'user-1', phone: '62999991234' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(linkCustomer('c1')).resolves.toBe('user-1');
  });

  it('includes an owner guard when updating the customer link', async () => {
    mockQuery
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c1',
            owner_user_id: 'owner',
            email: 'a@example.com',
            phone: null,
            linked_user_id: null,
          },
        ]) as never,
      )
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
      .mockResolvedValueOnce(
        rows([
          {
            id: 'c9',
            owner_user_id: 'owner',
            email: 'a@example.com',
            phone: null,
            linked_user_id: null,
          },
        ]) as never,
      )
      .mockResolvedValueOnce(rows([{ id: 'user-1' }]) as never)
      .mockResolvedValueOnce(rows([]) as never);

    await expect(relinkCustomersForUser('user-1')).resolves.toBe(1);
  });

  it('skips candidate scan when user has no email and no phone', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([]) as never)
      .mockResolvedValueOnce(rows([{ email: null, phone: null }]) as never);

    await expect(relinkCustomersForUser('user-1')).resolves.toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe('ensureAdminRole', () => {
  it('does nothing when ADMIN_EMAIL is not configured', async () => {
    await ensureAdminRole();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('demotes the matching user role before promoting the admin role', async () => {
    process.env.ADMIN_EMAIL = 'admin@example.com';
    mockQuery.mockResolvedValueOnce(rows([]) as never).mockResolvedValueOnce(rows([]) as never);

    await ensureAdminRole();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(String(mockQuery.mock.calls[0][0])).toMatch(/role\s*=\s*\$1/i);
    expect(String(mockQuery.mock.calls[1][0])).toMatch(/role\s*=\s*\$1/i);
  });
});
