import { describe, expect, it } from 'vitest';
import { attentionItems, type AttentionCustomer, type AttentionTx } from './attention';

const now = new Date('2026-10-30T15:00:00-03:00').getTime();
const due = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

function customer(id: string, name: string, rawBalance: number, strategy = 'RETURN'): AttentionCustomer {
  return { id, name, rawBalance, overpaymentStrategy: strategy };
}

function debt(customerId: string, iso: string): AttentionTx {
  return { customerId, type: 'DEBT', status: 'CONFIRMED', amount: 10, dueDate: due(iso) };
}

describe('precisa da sua atenção', () => {
  it('some quando não há vencido, vencendo ou valor a devolver', () => {
    expect(attentionItems([customer('c1', 'TESTE Ana', 0)], [], now)).toEqual([]);
  });

  it('mostra no máximo 3, vencidos primeiro', () => {
    const customers = [
      customer('a', 'TESTE Ana', 10),
      customer('b', 'TESTE Bruno', 40),
      customer('c', 'TESTE Carlos', 30),
      customer('d', 'TESTE Duda', 20),
      customer('e', 'TESTE Eva', -15),
    ];
    const txs = [
      debt('a', '2026-10-25'),
      debt('b', '2026-10-20'),
      debt('c', '2026-11-01'),
      debt('d', '2026-10-01'),
    ];
    const items = attentionItems(customers, txs, now);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.name)).toEqual(['TESTE Bruno', 'TESTE Duda', 'TESTE Ana']);
    expect(items[0].reason).toBe('Venceu há 10 dias');
    expect(items.every((item) => item.kind === 'overdue')).toBe(true);
  });

  it('depois dos vencidos entram quem vence em até 7 dias e o que você deve devolver', () => {
    const items = attentionItems(
      [customer('a', 'TESTE Ana', 80), customer('b', 'TESTE Bruno', 50), customer('c', 'TESTE Carlos', -20)],
      [debt('a', '2026-10-28'), debt('b', '2026-11-01')],
      now,
    );
    expect(items.map((item) => item.kind)).toEqual(['overdue', 'dueSoon', 'refund']);
    expect(items[1].reason).toBe('Vence em 2 dias');
    expect(items[2].reason).toBe('Você deve devolver');
    expect(items[2].amount).toBe(20);
  });
});
