import { todayKey } from './overdue';

export type LedgerTx = {
  type: string;
  amount: number;
  status?: string;
  timestamp: number;
};

export type LedgerSums = {
  debt: number;
  payment: number;
  refund: number;
  abatement: number;
};

export type PeriodPreset = '7' | '30' | 'month' | 'lastMonth' | 'custom';

const EMPTY: LedgerSums = { debt: 0, payment: 0, refund: 0, abatement: 0 };

/**
 * Soma lançamentos confirmados. O gráfico do Início usa o mesmo corte:
 * status CONFIRMED e timestamp até o fim do dia (ou da janela).
 */
export function sumConfirmed(transactions: LedgerTx[], range?: { from?: number; to?: number }): LedgerSums {
  const sums = { ...EMPTY };
  for (const tx of transactions) {
    if (tx.status !== 'CONFIRMED') continue;
    if (range?.from !== undefined && tx.timestamp < range.from) continue;
    if (range?.to !== undefined && tx.timestamp > range.to) continue;
    if (tx.type === 'DEBT') sums.debt += tx.amount;
    else if (tx.type === 'PAYMENT') sums.payment += tx.amount;
    else if (tx.type === 'REFUND') sums.refund += tx.amount;
    else if (tx.type === 'ABATIMENTO') sums.abatement += tx.amount;
  }
  return sums;
}

/** O que o gráfico chama de Fiado e Recebido até um instante. */
export function cumulativeThrough(transactions: LedgerTx[], until: number): { Offered: number; Received: number } {
  const sums = sumConfirmed(transactions, { to: until });
  return { Offered: sums.debt, Received: sums.payment };
}

/** Recebido e abatido entram. Dívida e devolução saem. */
export function periodResult(sums: LedgerSums): number {
  return sums.payment + sums.abatement - sums.debt - sums.refund;
}

export function activeDebtorLabel(count: number): string {
  return count === 1 ? '1 devedor ativo' : `${count} devedores ativos`;
}

export function startOfSpDay(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00-03:00`).getTime();
}

export function endOfSpDay(isoDate: string): number {
  return new Date(`${isoDate}T23:59:59.999-03:00`).getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function addCalendarDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return date.toISOString().slice(0, 10);
}

export function periodRange(
  preset: PeriodPreset,
  now: number,
  custom?: { from?: string; to?: string },
): { from: number; to: number } {
  const today = todayKey(now);
  const [year, month] = today.split('-').map(Number);
  if (preset === '7' || preset === '30') {
    const span = preset === '7' ? 6 : 29;
    return { from: startOfSpDay(addCalendarDays(today, -span)), to: endOfSpDay(today) };
  }
  if (preset === 'lastMonth') {
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const previousYear = previous.getUTCFullYear();
    const previousMonth = previous.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
    const start = `${previousYear}-${pad(previousMonth)}-01`;
    const end = `${previousYear}-${pad(previousMonth)}-${pad(lastDay)}`;
    return { from: startOfSpDay(start), to: endOfSpDay(end) };
  }
  if (preset === 'custom') {
    const from = custom?.from && /^\d{4}-\d{2}-\d{2}$/.test(custom.from) ? custom.from : today;
    const to = custom?.to && /^\d{4}-\d{2}-\d{2}$/.test(custom.to) ? custom.to : today;
    const [start, end] = from <= to ? [from, to] : [to, from];
    return { from: startOfSpDay(start), to: endOfSpDay(end) };
  }
  return { from: startOfSpDay(`${year}-${pad(month)}-01`), to: endOfSpDay(today) };
}
