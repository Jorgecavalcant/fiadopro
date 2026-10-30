import { describe, expect, it } from 'vitest';
import {
  activeDebtorLabel,
  cumulativeThrough,
  periodRange,
  periodResult,
  sumConfirmed,
  type LedgerTx,
} from './ledgerPeriod';

const day = (iso: string, hour = 12) => new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00-03:00`).getTime();

const rows: LedgerTx[] = [
  { type: 'DEBT', amount: 100, status: 'CONFIRMED', timestamp: day('2026-10-02') },
  { type: 'PAYMENT', amount: 40, status: 'CONFIRMED', timestamp: day('2026-10-03') },
  { type: 'REFUND', amount: 10, status: 'CONFIRMED', timestamp: day('2026-10-04') },
  { type: 'ABATIMENTO', amount: 15, status: 'CONFIRMED', timestamp: day('2026-10-05') },
  { type: 'DEBT', amount: 999, status: 'PENDING', timestamp: day('2026-10-06') },
  { type: 'DEBT', amount: 50, status: 'CONFIRMED', timestamp: day('2026-09-20') },
];

describe('período do extrato', () => {
  it('soma só o confirmado e bate com o acumulado do gráfico', () => {
    const until = day('2026-10-05', 23);
    const sums = sumConfirmed(rows, { to: until });
    const chart = cumulativeThrough(rows, until);
    expect(chart.Offered).toBe(sums.debt);
    expect(chart.Received).toBe(sums.payment);
    expect(sums).toEqual({ debt: 150, payment: 40, refund: 10, abatement: 15 });
    expect(periodResult(sums)).toBe(40 + 15 - 150 - 10);
  });

  it('o mês atual não mistura o mês passado', () => {
    const now = day('2026-10-15');
    const range = periodRange('month', now);
    const month = sumConfirmed(rows, range);
    const all = sumConfirmed(rows, { to: now });
    expect(month.debt).toBe(100);
    expect(all.debt).toBe(150);
    expect(cumulativeThrough(rows, now).Offered).toBe(all.debt);
  });

  it('plural de devedores', () => {
    expect(activeDebtorLabel(1)).toBe('1 devedor ativo');
    expect(activeDebtorLabel(0)).toBe('0 devedores ativos');
    expect(activeDebtorLabel(3)).toBe('3 devedores ativos');
  });
});
