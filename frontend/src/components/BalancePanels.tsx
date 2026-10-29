import { AlertTriangle } from 'lucide-react';
import type { TransactionType } from '../types';
import { wholeAmount } from '../utils/launchBalance';

export function balanceDirection(
  rawBalance: number,
  formatCurrency: (value: number) => string,
): { text: string; color: string } {
  if (rawBalance > 0) {
    return { text: `Te deve ${formatCurrency(rawBalance)}`, color: '#DC2626' };
  }
  if (rawBalance < 0) {
    return { text: `Você deve ${formatCurrency(Math.abs(rawBalance))}`, color: '#059669' };
  }
  return { text: 'Em dia', color: '#94A3B8' };
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
  const background = rawBalance > 0 ? '#FEF2F2' : rawBalance < 0 ? '#ECFDF5' : '#F8FAFC';
  return (
    <div
      role="status"
      aria-label="Saldo atual"
      style={{
        marginBottom: 20,
        padding: '18px 20px',
        borderRadius: 18,
        background,
        border: '1px solid #E2E8F0',
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#64748B',
          margin: 0,
        }}
      >
        Saldo atual
      </p>
      <p style={{ fontSize: 28, fontWeight: 900, margin: '6px 0 0', color: sense.color }}>
        {sense.text}
      </p>
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
    <div
      role="status"
      data-credit-notice=""
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        marginBottom: 32,
        padding: '14px 16px',
        borderRadius: 16,
        background: '#FFFBEB',
        border: '1px solid #D97706',
        color: '#1C2446',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle
          aria-hidden="true"
          style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, color: '#92400E' }}
        />
        <h4
          style={{
            margin: 0,
            minWidth: 0,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1.35,
            color: '#1C2446',
            overflowWrap: 'normal',
            wordBreak: 'normal',
          }}
        >
          Você deve <span style={{ color: '#92400E' }}>{money}</span> a este cliente
        </h4>
      </div>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.4,
          color: '#1C2446',
          overflowWrap: 'normal',
          wordBreak: 'normal',
        }}
      >
        Use Devolução para devolver o dinheiro ou Abatimento para descontar em compras futuras.
      </p>
    </div>
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
      className="mt-3 w-full py-3 rounded-2xl font-black text-base text-white"
      style={{ background: type === 'REFUND' ? '#3D559C' : '#7252E2' }}
    >
      {label}
    </button>
  );
}
