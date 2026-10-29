/**
 * Atraso do Fiado Pro.
 * Conta só dívida confirmada, em aberto, com vencimento anterior a hoje
 * no fuso America/Sao_Paulo. Sem vencimento nunca é atraso.
 * Em aberto = o cliente ainda tem saldo positivo (rawBalance > 0).
 *
 * O vencimento gravado pelo calendário é meia-noite UTC (o dia que o
 * lojista escolheu). "Hoje" é o dia civil em São Paulo.
 */

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

export interface OverdueTx {
  customerId: string;
  type: string;
  status: string;
  amount: number;
  dueDate?: number | null;
}

export interface OverdueCustomer {
  id: string;
  rawBalance: number;
}

export interface OverdueResult {
  /** Quantidade de lançamentos vencidos que entram na conta. */
  count: number;
  /** Soma desses lançamentos — não o saldo inteiro do cliente. */
  amount: number;
  customerIds: string[];
}

/** Dia civil YYYY-MM-DD do vencimento escolhido no calendário. */
export function dueDayKey(dueDate: number): string {
  const d = new Date(dueDate);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dia civil de hoje em America/Sao_Paulo, YYYY-MM-DD. */
export function todayKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

export function isDueBeforeToday(dueDate: number, now: number): boolean {
  return dueDayKey(dueDate) < todayKey(now);
}

export function formatDueDate(dueDate?: number | null): string {
  if (dueDate == null || !Number.isFinite(dueDate)) return 'Sem vencimento';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dueDate));
}

export function isOverdueDebt(tx: OverdueTx, rawBalance: number, now: number = Date.now()): boolean {
  if (rawBalance <= 0) return false;
  if (tx.type !== 'DEBT' || tx.status !== 'CONFIRMED') return false;
  if (tx.dueDate == null || !Number.isFinite(tx.dueDate)) return false;
  return isDueBeforeToday(tx.dueDate, now);
}

export function summarizeOverdue(
  transactions: OverdueTx[],
  customers: OverdueCustomer[],
  now: number = Date.now(),
): OverdueResult {
  const openIds = new Set(customers.filter((c) => c.rawBalance > 0).map((c) => c.id));
  const customerIds = new Set<string>();
  let count = 0;
  let amount = 0;
  for (const tx of transactions) {
    if (!openIds.has(tx.customerId)) continue;
    const customer = customers.find((c) => c.id === tx.customerId);
    if (!customer || !isOverdueDebt(tx, customer.rawBalance, now)) continue;
    count += 1;
    amount += tx.amount;
    customerIds.add(tx.customerId);
  }
  return { count, amount, customerIds: [...customerIds] };
}
