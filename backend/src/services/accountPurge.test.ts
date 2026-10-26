import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ query }));

import {
  confirmAccountDeletion,
  purgeExpiredAccounts,
} from './accountPurge.js';

describe('account purge', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('purges only the returned expired user id', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'expired-user' }] });
    query.mockResolvedValue({ rows: [] });

    await purgeExpiredAccounts();

    expect(query).toHaveBeenCalledTimes(7);
    for (const [, params] of query.mock.calls.slice(1)) {
      expect(params).toEqual(['expired-user']);
    }
  });

  it('does not include another user id in the cleanup SQL', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'expired-user' }] });
    query.mockResolvedValue({ rows: [] });

    await purgeExpiredAccounts();

    const cleanupSql = query.mock.calls.slice(1).map(([sql]) => String(sql)).join('\n');
    expect(cleanupSql).not.toContain('other-user');
    expect(cleanupSql).not.toContain('linked_user_id');
    expect(cleanupSql).not.toContain('created_by_user_id');
    expect(cleanupSql).not.toContain('DELETE FROM users');
  });

  it('accepts CANCELAR for a Google-only account', () => {
    expect(confirmAccountDeletion({ password_hash: null }, ' CANCELAR ', false)).toBeNull();
  });

  it('requires the exact trimmed confirmation for a Google-only account', () => {
    expect(confirmAccountDeletion({ password_hash: null }, 'cancelar', false))
      .toBe('INVALID_CONFIRMATION');
  });

  it('requires a matching password when a password hash exists', () => {
    expect(confirmAccountDeletion({ password_hash: 'hash' }, 'CANCELAR', false))
      .toBe('INVALID_PASSWORD');
  });
});
