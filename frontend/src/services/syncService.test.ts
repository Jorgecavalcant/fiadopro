import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapSync, resetSyncState, fetchInbox } from './syncService';
import { Customer, Transaction } from '../types';

// Ambiente node: stub de localStorage e fetch
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

const localCustomer: Customer = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Dyllan',
  phone: '62 99999-1234',
  createdAt: 1700000000000,
};

const localTx: Transaction = {
  id: 'bbbbbbbb-0000-4000-8000-000000000001',
  customerId: localCustomer.id,
  amount: 50,
  type: 'DEBT',
  description: 'fiado',
  timestamp: 1700000001000,
  status: 'CONFIRMED',
  eventId: 'evento-local-123',
};

beforeEach(() => {
  store.clear();
  mockFetch.mockReset();
  resetSyncState();
});

describe('bootstrapSync', () => {
  it('migra o legado uma única vez e puxa o estado do servidor', async () => {
    mockFetch
      .mockReturnValueOnce(ok({ success: true, customersImported: 1, transactionsImported: 1 })) // import
      .mockReturnValueOnce(
        ok({
          success: true,
          customers: [
            {
              id: localCustomer.id,
              linked_user_id: 'user-dyllan',
              name: 'Dyllan',
              phone: '62 99999-1234',
              email: null,
              pix_key: null,
              trusted: false,
              overpayment_strategy: 'RETURN',
              notes: [],
              score: null,
              created_at: '2023-11-14T00:00:00.000Z',
            },
          ],
        })
      )
      .mockReturnValueOnce(
        ok({
          success: true,
          transactions: [
            {
              id: localTx.id,
              customer_id: localCustomer.id,
              type: 'DEBT',
              status: 'PENDING',
              amount: '50.00',
              description: 'fiado',
              occurred_at: '2023-11-14T00:00:01.000Z',
              due_date: null,
              payment_method: null,
              attachment: null,
              installment_number: null,
              total_installments: null,
              installment_group_id: null,
              interest_rate: null,
            },
          ],
        })
      );

    const result = await bootstrapSync([localCustomer], [localTx]);

    expect(result.online).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/sync/import');
    // status do servidor vence; campos locais (eventId) são preservados
    expect(result.transactions[0].status).toBe('PENDING');
    expect(result.transactions[0].eventId).toBe('evento-local-123');
    expect(result.transactions[0].amount).toBe(50);
    expect(store.get('fiado_pro_migrated_v1')).toBe('1');
  });

  it('não repete a migração quando a flag já existe', async () => {
    store.set('fiado_pro_migrated_v1', '1');
    mockFetch
      .mockReturnValueOnce(ok({ success: true, customers: [] }))
      .mockReturnValueOnce(ok({ success: true, transactions: [] }));

    await bootstrapSync([localCustomer], [localTx]);

    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/sync/import'))).toBe(false);
  });

  it('offline: devolve o estado local sem quebrar (cache é fallback)', async () => {
    store.set('fiado_pro_migrated_v1', '1');
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await bootstrapSync([localCustomer], [localTx]);

    expect(result.online).toBe(false);
    expect(result.customers).toEqual([localCustomer]);
    expect(result.transactions).toEqual([localTx]);
  });
});

describe('fetchInbox', () => {
  it('devolve itens em sucesso e lista vazia em erro de rede', async () => {
    mockFetch.mockReturnValueOnce(ok({ success: true, items: [{ id: 't1' }] }));
    expect((await fetchInbox()).length).toBe(1);

    mockFetch.mockRejectedValueOnce(new Error('down'));
    expect(await fetchInbox()).toEqual([]);
  });
});
