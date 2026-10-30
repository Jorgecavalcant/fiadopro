import { Notice } from './ui/Notice';
import type { TransactionType } from '../types';
import { wholeAmount } from '../utils/launchBalance';

export function balanceDirection(
  rawBalance: number,
  formatCurrency: (value: number) => string,
): { text: string; color: string } {
  if (rawBalance > 0) {
    return { text: `Te deve ${formatCurrency(rawBalance)}`, color: '#B3261E' };
  }
  if (rawBalance < 0) {
    return { text: `Você deve ${formatCurrency(Math.abs(rawBalance))}`, color: '#1F7A4D' };
  }
  return { text: 'Em dia', color: '#5C5C5C' };
}

/** O mesmo cartão das quatro abas de lançamento. */
export function CurrentBalanceBanner({
  rawBalance,
  formatCurrency,
}: {
  rawBalance: number;
  formatCurrency: (value: number) => string;
}) {
  const sense = balanceDirection(rawBalance, formatCurrency);
  return (
    <div className="fp-card fp-balance-now" role="status" aria-label="Saldo atual">
      <p>Saldo atual</p>
      <strong style={{ color: sense.color }}>{sense.text}</strong>
    </div>
  );
}

/** Aviso de saldo credor. Sem botão. Só quando o lojista deve ao cliente. */
export function CreditBalanceNotice({
  rawBalance,
  formatCurrency,
}: {
  rawBalance: number;
  formatCurrency: (value: number) => string;
}) {
  if (rawBalance >= 0) return null;
  const money = formatCurrency(Math.abs(rawBalance));
  return (
    <Notice
      data-credit-notice=""
      role="status"
      title={`Você deve ${money} a este cliente`}
    >
      Use Devolução para devolver o dinheiro ou Abatimento para descontar em compras futuras.
    </Notice>
  );
}

export function WholeBalanceButton({
  type,
  rawBalance,
  onFill,
}: {
  type: TransactionType;
  rawBalance: number;
  onFill: (amount: number) => void;
}) {
  if (type !== 'REFUND' && type !== 'ABATIMENTO') return null;
  const amount = wholeAmount(rawBalance, type);
  if (amount == null) return null;
  const label = type === 'REFUND' ? 'Devolver tudo' : 'Abater tudo';
  return (
    <button
      type="button"
      onClick={() => onFill(amount)}
      className="mt-3 w-full py-3 rounded-full font-semibold text-base text-white"
      style={{ background: '#2B2F77' }}
    >
      {label}
    </button>
  );
}
