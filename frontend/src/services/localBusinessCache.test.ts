import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  MIGRATED_FLAG,
  DATA_EPOCH_KEY,
  clearBusinessLocalCache,
  isStoredUserMismatch,
  readStoredUserIdentity,
} from './localBusinessCache';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
});

describe('clearBusinessLocalCache', () => {
  it('remove STORAGE_KEY de negócio e flags; mantém idioma', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        customers: [{ id: 'c1' }],
        transactions: [{ id: 't1' }],
        events: [{ id: 'e1' }],
        debts: [{ id: 'd1' }],
        auditLog: [{ id: 'a1' }],
        language: 'en',
        user: { id: 'u1', email: 'a@b.com' },
      }),
    );
    store.set(MIGRATED_FLAG, '1');
    store.set(DATA_EPOCH_KEY, 'old-epoch');
    store.set('fiado_pro_hide_values', '1');

    clearBusinessLocalCache({ clearEpoch: true });

    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify({ language: 'en' }));
    expect(store.has(MIGRATED_FLAG)).toBe(false);
    expect(store.has(DATA_EPOCH_KEY)).toBe(false);
    expect(store.get('fiado_pro_hide_values')).toBe('1');
  });

  it('após bump de epoch: limpa negócio sem apagar o epoch novo', () => {
    store.set(STORAGE_KEY, JSON.stringify({ customers: [{ id: 'c1' }], language: 'pt-BR' }));
    store.set(DATA_EPOCH_KEY, '2026-11-17T09:12:00Z');
    store.set(MIGRATED_FLAG, '1');

    clearBusinessLocalCache({ clearEpoch: false });

    expect(store.get(DATA_EPOCH_KEY)).toBe('2026-11-17T09:12:00Z');
    expect(store.get(MIGRATED_FLAG)).toBe('1');
    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify({ language: 'pt-BR' }));
  });
});

describe('isStoredUserMismatch', () => {
  it('limpa quando id do cache diverge do usuário que entrou', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({ user: { id: 'user-a', email: 'a@x.com' }, customers: [] }),
    );
    expect(isStoredUserMismatch({ id: 'user-b', email: 'a@x.com' })).toBe(true);
    expect(readStoredUserIdentity()?.id).toBe('user-a');
  });

  it('não marca mismatch quando é o mesmo usuário', () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({ user: { id: 'user-a', email: 'a@x.com' } }),
    );
    expect(isStoredUserMismatch({ id: 'user-a', email: 'a@x.com' })).toBe(false);
  });

  it('sem usuário no cache não é mismatch', () => {
    store.set(STORAGE_KEY, JSON.stringify({ customers: [{ id: 'c1' }] }));
    expect(isStoredUserMismatch({ id: 'user-a', email: 'a@x.com' })).toBe(false);
  });
});
