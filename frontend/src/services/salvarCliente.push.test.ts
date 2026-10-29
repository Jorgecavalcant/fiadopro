import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Customer, Transaction } from '../types';
import { bootstrapSync, resetSyncState, saveCustomerToServer, schedulePush } from './syncService';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);

function customerId(n: number) {
  return `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function txId(n: number) {
  return `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function serverCustomers(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      id: customerId(n),
      linked_user_id: null,
      name: `Cliente ${n}`,
      phone: `1198000${String(n).padStart(4, '0')}`,
      email: null,
      pix_key: null,
      trusted: false,
      overpayment_strategy: 'RETURN' as const,
      notes: [],
      score: null,
      created_at: '2026-01-01T00:00:00.000Z',
      pending_count: '1',
    };
  });
}

function serverTransactions(countCustomers: number) {
  const rows = [];
  let n = 1;
  for (let c = 1; c <= countCustomers; c += 1) {
    rows.push({
      id: txId(n),
      customer_id: customerId(c),
      type: 'DEBT',
      status: 'PENDING',
      amount: '10.00',
      description: 'fiado',
      occurred_at: '2026-01-02T00:00:00.000Z',
      due_date: null,
      payment_method: null,
      attachment: null,
      installment_number: null,
      total_installments: null,
      installment_group_id: null,
      interest_rate: null,
    });
    n += 1;
    rows.push({
      id: txId(n),
      customer_id: customerId(c),
      type: 'PAYMENT',
      status: 'CONFIRMED',
      amount: '5.00',
      description: 'pagamento',
      occurred_at: '2026-01-03T00:00:00.000Z',
      due_date: null,
      payment_method: null,
      attachment: null,
      installment_number: null,
      total_installments: null,
      installment_group_id: null,
      interest_rate: null,
    });
    n += 1;
  }
  return rows;
}

const calls: { url: string; method: string }[] = [];

function installFetch() {
  const customers = serverCustomers(20);
  const transactions = serverTransactions(20);
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const target = String(url);
    calls.push({ url: target, method });
    if (method === 'GET' && target.endsWith('/customers')) {
      return ok({ success: true, customers });
    }
    if (method === 'GET' && target.endsWith('/transactions')) {
      return ok({ success: true, transactions });
    }
    return ok({ success: true, transaction: { status: 'CONFIRMED' } });
  });
}

async function knownShadow() {
  store.set('fiado_pro_migrated_v1', '1');
  const result = await bootstrapSync([], []);
  expect(result.online).toBe(true);
  expect(result.customers).toHaveLength(20);
  expect(result.transactions).toHaveLength(40);
  return result;
}

function draftCustomer(): Customer {
  return {
    notes: [],
    createdAt: 1700000000000,
    overpaymentStrategy: 'PROFIT',
    name: 'Cliente novo',
    phone: '11977776666',
    email: '',
    pixKey: '',
    id: customerId(99),
  };
}

function stateAfterSave(draft: Customer): Customer {
  return {
    id: draft.id,
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
    pixKey: draft.pixKey,
    notes: [],
    createdAt: draft.createdAt,
    overpaymentStrategy: 'PROFIT',
  };
}

async function flushPush(customers: Customer[], transactions: Transaction[]) {
  calls.length = 0;
  vi.useFakeTimers();
  schedulePush(true, customers, transactions, () => {});
  await vi.advanceTimersByTimeAsync(4000);
  vi.useRealTimers();
  return calls.map((call) => ({ ...call }));
}

beforeEach(() => {
  store.clear();
  calls.length = 0;
  mockFetch.mockReset();
  resetSyncState();
  installFetch();
});

describe('pushDiffs depois de salvar um cliente', () => {
  it('conta as chamadas quando o shadow já conhece 20 clientes e 40 lançamentos', async () => {
    const known = await knownShadow();
    const draft = draftCustomer();
    calls.length = 0;
    const message = await saveCustomerToServer(draft, false);
    expect(message).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/customers');

    const pushCalls = await flushPush(
      [...known.customers, stateAfterSave(draft)],
      known.transactions,
    );
    console.log(`MEDICAO_PUSH_IGUAL ${JSON.stringify(pushCalls)}`);
    expect(pushCalls).toEqual([]);
  });

  it('conta as chamadas quando o fingerprint não bate', async () => {
    const known = await knownShadow();
    const draft = draftCustomer();
    await saveCustomerToServer(draft, false);
    const changedCustomers = known.customers.map((customer) => ({
      ...customer,
      name: `${customer.name} alterado`,
    }));
    const changedTransactions = known.transactions.map((transaction) => ({
      ...transaction,
      description: `${transaction.description} alterado`,
    }));
    const pushCalls = await flushPush(
      [...changedCustomers, stateAfterSave(draft)],
      changedTransactions,
    );
    console.log(`MEDICAO_PUSH_DIFERENTE ${pushCalls.length}`);
    expect(pushCalls.filter((call) => call.url.includes('/customers'))).toHaveLength(20);
    expect(pushCalls.filter((call) => call.url.includes('/transactions'))).toHaveLength(40);
  });

  it('conta as chamadas quando null e undefined trocam de lugar', async () => {
    const known = await knownShadow();
    const draft = draftCustomer();
    await saveCustomerToServer(draft, false);
    const roundTrip = JSON.parse(JSON.stringify(known.customers)) as Customer[];
    const withNulls = roundTrip.map((customer) => ({
      ...customer,
      email: null as unknown as undefined,
      pixKey: null as unknown as undefined,
      score: null as unknown as undefined,
      notes: customer.notes ?? [],
    }));
    const txs = known.transactions.map((transaction) => ({
      ...transaction,
      dueDate: null as unknown as undefined,
      paymentMethod: null as unknown as undefined,
      attachment: null as unknown as undefined,
      interestRate: null as unknown as undefined,
    }));
    const pushCalls = await flushPush([...withNulls, stateAfterSave(draft)], txs);
    console.log(`MEDICAO_PUSH_NULL ${pushCalls.length}`);
    expect(pushCalls).toEqual([]);
  });
});
