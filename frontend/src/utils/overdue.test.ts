import { describe, expect, it } from 'vitest';
import { summarizeOverdue } from './overdue';

const now = Date.parse('2026-10-29T15:00:00-03:00');

describe('summarizeOverdue', () => {
  it('conta só a dívida vencida e deixa de fora a que não tem vencimento', () => {
    const overdueDue = Date.parse('2026-10-28T00:00:00Z');
    const result = summarizeOverdue(
      [
        {
          customerId: 'c1',
          type: 'DEBT',
          status: 'CONFIRMED',
          amount: 80,
          dueDate: overdueDue,
        },
        {
          customerId: 'c1',
          type: 'DEBT',
          status: 'CONFIRMED',
          amount: 40,
        },
      ],
      [{ id: 'c1', rawBalance: 120 }],
      now,
    );

    expect(result.count).toBe(1);
    expect(result.amount).toBe(80);
    expect(result.customerIds).toEqual(['c1']);
  });

  it('não conta quando o saldo não é positivo nem quando o vencimento é hoje', () => {
    const yesterday = Date.parse('2026-10-28T00:00:00Z');
    const today = Date.parse('2026-10-29T00:00:00Z');
    const debt = {
      customerId: 'c1',
      type: 'DEBT' as const,
      status: 'CONFIRMED' as const,
      amount: 80,
      dueDate: yesterday,
    };

    expect(summarizeOverdue([debt], [{ id: 'c1', rawBalance: 0 }], now).count).toBe(0);
    expect(summarizeOverdue([debt], [{ id: 'c1', rawBalance: -10 }], now).amount).toBe(0);
    expect(
      summarizeOverdue([{ ...debt, dueDate: today }], [{ id: 'c1', rawBalance: 80 }], now).count,
    ).toBe(0);
  });
});
