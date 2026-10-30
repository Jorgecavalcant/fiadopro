import { startOfSpDay } from './ledgerPeriod';
import { dueDayKey, isDueBeforeToday, todayKey } from './overdue';

export type AttentionKind = 'overdue' | 'dueSoon' | 'refund';

export type AttentionCustomer = {
  id: string;
  name: string;
  rawBalance: number;
  overpaymentStrategy?: string;
};

export type AttentionTx = {
  customerId: string;
  type: string;
  status: string;
  amount: number;
  dueDate?: number | null;
};

export type AttentionItem = {
  customerId: string;
  name: string;
  kind: AttentionKind;
  reason: string;
  amount: number;
};

function daySpan(fromKey: string, toKey: string): number {
  return Math.round((startOfSpDay(toKey) - startOfSpDay(fromKey)) / 86_400_000);
}

function reasonFor(days: number, past: boolean): string {
  if (days <= 0) return past ? 'Venceu hoje' : 'Vence hoje';
  const unit = days === 1 ? 'dia' : 'dias';
  return past ? `Venceu há ${days} ${unit}` : `Vence em ${days} ${unit}`;
}

/** No máximo 3: vencidos, depois quem vence em até 7 dias, depois o que você deve devolver. */
export function attentionItems(
  customers: AttentionCustomer[],
  transactions: AttentionTx[],
  now: number = Date.now(),
): AttentionItem[] {
  const today = todayKey(now);
  const overdue: AttentionItem[] = [];
  const soon: { days: number; item: AttentionItem }[] = [];
  const refunds: AttentionItem[] = [];

  for (const customer of customers) {
    if (customer.rawBalance < 0 && customer.overpaymentStrategy === 'RETURN') {
      refunds.push({
        customerId: customer.id,
        name: customer.name,
        kind: 'refund',
        reason: 'Você deve devolver',
        amount: Math.abs(customer.rawBalance),
      });
      continue;
    }
    if (customer.rawBalance <= 0) continue;
    const debts = transactions.filter(
      (tx) =>
        tx.customerId === customer.id &&
        tx.type === 'DEBT' &&
        tx.status === 'CONFIRMED' &&
        tx.dueDate != null &&
        Number.isFinite(tx.dueDate),
    );
    const late = debts.filter((tx) => isDueBeforeToday(tx.dueDate as number, now));
    if (late.length > 0) {
      const oldest = late.map((tx) => dueDayKey(tx.dueDate as number)).sort()[0];
      overdue.push({
        customerId: customer.id,
        name: customer.name,
        kind: 'overdue',
        reason: reasonFor(daySpan(oldest, today), true),
        amount: customer.rawBalance,
      });
      continue;
    }
    const upcoming = debts
      .map((tx) => ({ key: dueDayKey(tx.dueDate as number) }))
      .map((entry) => ({ ...entry, days: daySpan(today, entry.key) }))
      .filter((entry) => entry.days >= 0 && entry.days <= 7)
      .sort((a, b) => a.days - b.days);
    if (upcoming.length > 0) {
      soon.push({
        days: upcoming[0].days,
        item: {
          customerId: customer.id,
          name: customer.name,
          kind: 'dueSoon',
          reason: reasonFor(upcoming[0].days, false),
          amount: customer.rawBalance,
        },
      });
    }
  }

  overdue.sort((a, b) => b.amount - a.amount);
  soon.sort((a, b) => a.days - b.days);
  refunds.sort((a, b) => b.amount - a.amount);
  return [...overdue, ...soon.map((entry) => entry.item), ...refunds].slice(0, 3);
}
