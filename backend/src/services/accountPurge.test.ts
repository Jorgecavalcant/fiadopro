import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, getClient } = vi.hoisted(() => {
  const query = vi.fn();
  const getClient = vi.fn(async () => ({
    query,
    release() {},
  }));
  return { query, getClient };
});

vi.mock('../config/database.js', () => ({ query, getClient }));

import {
  confirmAccountDeletion,
  purgeExpiredAccounts,
} from './accountPurge.js';

describe('account purge', () => {
  beforeEach(() => {
    query.mockReset();
    getClient.mockClear();
  });

  it('purges only the returned expired user id', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'expired-user' }] }) // select expired
      .mockResolvedValueOnce({ rows: [{ legal_hold: false }] }) // FOR UPDATE
      .mockResolvedValue({ rows: [] });

    await purgeExpiredAccounts();

    expect(getClient).toHaveBeenCalled();
    const userBound = query.mock.calls.filter(([, params]) => params?.[0] === 'expired-user');
    expect(userBound.length).toBeGreaterThan(0);
  });

  it('selects eligible expired accounts and unlinks customers before cleanup', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'expired-user' }] })
      .mockResolvedValueOnce({ rows: [{ legal_hold: false }] })
      .mockResolvedValue({ rows: [] });

    await purgeExpiredAccounts();

    const selectionSql = String(query.mock.calls[0][0]);
    expect(selectionSql).toContain('purge_after <= NOW()');
    expect(selectionSql).toContain('deleted_at IS NOT NULL');
    expect(selectionSql).toContain('purge_completed_at IS NULL');
    expect(selectionSql).toContain('legal_hold IS NOT TRUE');

    const allSql = query.mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(allSql).toContain('UPDATE customers SET linked_user_id = NULL');
    expect(allSql).toContain('owner_user_id = $1');
    expect(allSql).toContain('WHERE user_id = $1');
    expect(allSql).not.toContain('DELETE FROM users');
  });

  it('accepts CANCELAR for a Google-only account', () => {
    expect(confirmAccountDeletion({ password_hash: null }, ' CANCELAR ', false)).toBeNull();
  });

  it('requires the exact trimmed confirmation for a Google-only account', () => {
    expect(confirmAccountDeletion({ password_hash: null }, 'cancelar', false)).toBe(
      'INVALID_CONFIRMATION',
    );
  });

  it('requires a matching password when a password hash exists', () => {
    expect(confirmAccountDeletion({ password_hash: 'hash' }, 'CANCELAR', false)).toBe(
      'INVALID_PASSWORD',
    );
  });
});
