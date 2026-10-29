import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pushLocalChanges, resetSyncState } from './syncService';
import type { Transaction } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'bbbbbbbb-0000-4000-8000-000000000010',
    customerId: 'aaaaaaaa-0000-4000-8000-000000000001',
    amount: 100,
    type: 'PAYMENT',
    description: 'pago',
    timestamp: 1,
    status: 'CONFIRMED',
    ...over,
  };
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
  resetSyncState();
});

describe('fila quando o pagamento vira crédito', () => {
  it('o 409 marca o pagamento e o lançamento seguinte segue', async () => {
    const payment = tx({ id: 'bbbbbbbb-0000-4000-8000-000000000010' });
    const debt = tx({
      id: 'bbbbbbbb-0000-4000-8000-000000000011',
      type: 'DEBT',
      amount: 20,
    });
    const asked: string[] = [];
    mockFetch
      .mockReturnValueOnce(
        jsonResponse(409, { error: { code: 'CREDIT_CONFIRMATION_REQUIRED' } }),
      )
      .mockReturnValueOnce(
        jsonResponse(201, {
          success: true,
          transaction: { id: debt.id, status: 'CONFIRMED' },
        }),
      );

    await pushLocalChanges([], [payment, debt], () => undefined, (id) => asked.push(id));

    expect(asked).toEqual([payment.id]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(mockFetch.mock.calls[0][1].body)) as {
      confirmCredit?: boolean;
    };
    const secondBody = JSON.parse(String(mockFetch.mock.calls[1][1].body)) as { type?: string };
    expect(firstBody.confirmCredit).toBeUndefined();
    expect(secondBody.type).toBe('DEBT');

    mockFetch.mockReset();
    await pushLocalChanges([], [payment, debt], () => undefined, (id) => asked.push(id));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('com a confirmação do lojista, o envio leva o flag', async () => {
    const payment = tx({ creditConfirmed: true });
    mockFetch.mockReturnValueOnce(
      jsonResponse(201, {
        success: true,
        transaction: { id: payment.id, status: 'CONFIRMED' },
      }),
    );
    const asked: string[] = [];
    await pushLocalChanges([], [payment], () => undefined, (id) => asked.push(id));
    expect(asked).toEqual([]);
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body)) as { confirmCredit?: boolean };
    expect(body.confirmCredit).toBe(true);
  });
});
