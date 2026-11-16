vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query, getClient } from '../config/database.js';
import {
  confirmAccountDeletion,
  confirmImmediateDeletion,
  purgeUserDataNow,
} from './accountPurge.js';

const mockQuery = vi.mocked(query);
const mockGetClient = vi.mocked(getClient);
const rows = (data: unknown[]) => ({ rows: data, rowCount: data.length });

beforeEach(() => {
  mockQuery.mockReset();
  mockGetClient.mockReset();
  mockGetClient.mockResolvedValue({
    query: mockQuery,
    release() {},
  } as never);
});

describe('confirmImmediateDeletion', () => {
  it('accepts EXCLUIR when account has no password', () => {
    expect(confirmImmediateDeletion({ password_hash: null }, 'EXCLUIR', true)).toBeNull();
  });

  it('rejects invalid password', () => {
    expect(confirmImmediateDeletion({ password_hash: 'x' }, 'EXCLUIR', false)).toBe(
      'INVALID_PASSWORD',
    );
  });

  it('rejects invalid confirmation word', () => {
    expect(confirmImmediateDeletion({ password_hash: null }, 'nope', true)).toBe(
      'INVALID_CONFIRMATION',
    );
  });
});

describe('confirmAccountDeletion', () => {
  it('accepts matching password', () => {
    expect(confirmAccountDeletion({ password_hash: 'x' }, 'anything', true)).toBeNull();
  });

  it('accepts CANCELAR for google-only', () => {
    expect(confirmAccountDeletion({ password_hash: null }, 'CANCELAR', false)).toBeNull();
  });

  it('rejects wrong confirmation for google-only', () => {
    expect(confirmAccountDeletion({ password_hash: null }, 'x', false)).toBe(
      'INVALID_CONFIRMATION',
    );
  });
});

describe('purgeUserDataNow', () => {
  it('skips when legal_hold is true', async () => {
    mockQuery.mockResolvedValue(rows([{ legal_hold: true }]) as never);
    await purgeUserDataNow('user-1');
    expect(mockQuery.mock.calls.some(([sql]) => String(sql) === 'BEGIN')).toBe(true);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql) === 'ROLLBACK')).toBe(true);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM'))).toBe(false);
  });

  it('unlinks customers then deletes when not on hold', async () => {
    mockQuery
      .mockResolvedValueOnce(rows([{ legal_hold: false }]) as never)
      .mockResolvedValue(rows([]) as never);
    await purgeUserDataNow('user-1');
    expect(
      mockQuery.mock.calls.some(([sql]) => String(sql).includes('linked_user_id = NULL')),
    ).toBe(true);
    expect(mockQuery.mock.calls.length).toBeGreaterThan(1);
  });
});
