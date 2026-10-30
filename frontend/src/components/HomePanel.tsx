import { useState } from 'react';
import { Eye, EyeOff, Plus, ArrowDownLeft, SquareSplitHorizontal, UserPlus } from 'lucide-react';
import { activeDebtorLabel } from '../utils/ledgerPeriod';
import { QuickAction } from './ui/QuickAction';

const HIDE_KEY = 'fiado_pro_hide_values';

export function HomePanel({
  userName,
  formatCurrency,
  receivable,
  payable,
  overdue,
  overdueCustomers,
  activeDebtors,
  onNewDebt,
  onReceive,
  onSplit,
  onNewCustomer,
  onOverdue,
  onPayable,
}: {
  userName?: string;
  formatCurrency: (value: number) => string;
  receivable: number;
  payable: number;
  overdue: number;
  overdueCustomers: number;
  activeDebtors: number;
  onNewDebt: () => void;
  onReceive: () => void;
  onSplit: () => void;
  onNewCustomer: () => void;
  onOverdue: () => void;
  onPayable: () => void;
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const money = (value: number) => (hidden ? '••••' : formatCurrency(value));
  const first = userName?.trim().split(/\s+/)[0] || 'olá';

  const toggle = () => {
    setHidden((current) => {
      const next = !current;
      try {
        localStorage.setItem(HIDE_KEY, next ? '1' : '0');
      } catch {
        /* o aparelho pode bloquear o armazenamento; a escolha vale nesta tela */
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Olá, {first}</h2>
        <button type="button" className="fp-eye" onClick={toggle} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}>
          {hidden ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
        </button>
      </div>
      <article className="fp-card" style={{ padding: 16 }}>
        <div className="fp-balance-grid">
          <div>
            <p>A receber</p>
            <strong>{money(receivable)}</strong>
            <span>{hidden ? '••••' : activeDebtorLabel(activeDebtors)}</span>
          </div>
          <div>
            <p>A pagar</p>
            <strong>{money(payable)}</strong>
          </div>
          <div>
            <p>Em atraso</p>
            <strong style={{ color: overdue > 0 ? 'var(--fp-danger)' : 'var(--fp-text)' }}>{money(overdue)}</strong>
          </div>
        </div>
      </article>
      <div className="fp-shortcuts">
        <QuickAction icon={Plus} label="Nova dívida" onClick={onNewDebt} />
        <QuickAction icon={ArrowDownLeft} label="Receber" onClick={onReceive} />
        <QuickAction icon={SquareSplitHorizontal} label="Dividir conta" onClick={onSplit} />
        <QuickAction icon={UserPlus} label="Novo cliente" onClick={onNewCustomer} />
      </div>
      {overdueCustomers > 0 ? (
        <button type="button" className="fp-alert overdue" onClick={onOverdue}>
          <strong>Em atraso</strong>
          <span>
            {overdueCustomers === 1 ? '1 cliente' : `${overdueCustomers} clientes`} · {money(overdue)}
          </span>
        </button>
      ) : null}
      {payable > 0 ? (
        <button type="button" className="fp-alert return" onClick={onPayable}>
          <strong>Dinheiro a devolver</strong>
          <span>Você deve {money(payable)}</span>
        </button>
      ) : null}
    </div>
  );
}
