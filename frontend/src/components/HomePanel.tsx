import { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowRight, ChevronRight, Clock, Eye, EyeOff, Plus, Sparkles, SquareSplitHorizontal, Undo2, UserPlus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { activeDebtorLabel } from '../utils/ledgerPeriod';
import type { AttentionItem } from '../utils/attention';
import { AiAsk } from './AiAsk';
import { IconCircle } from './ui/IconCircle';
import { QuickAction } from './ui/QuickAction';

const HIDE_KEY = 'fiado_pro_hide_values';

type Point = { date: string; Offered: number; Received: number };

function Chart({ data }: { data: Point[] }) {
  return (
    <div className="fp-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--fp-line)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--fp-muted)', fontSize: 10 }} tickFormatter={(value: string) => value.slice(0, 5)} interval={2} />
          <Tooltip formatter={(value: number) => value} />
          <Bar dataKey="Offered" name="Fiado" fill="#2B2F77" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Received" name="Recebido" fill="#1F7A4D" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Sponsor() {
  return (
    <div className="fp-sponsor">
      <span />
      <div>
        <strong>Patrocinado</strong>
        <p>Espaço do patrocinador</p>
      </div>
      <ChevronRight size={16} strokeWidth={1.5} />
    </div>
  );
}

export function HomePanel({
  userName,
  initial,
  formatCurrency,
  receivable,
  payable,
  overdue,
  activeDebtors,
  onNewDebt,
  onReceive,
  onSplit,
  onNewCustomer,
  onStatement,
  onOpenCustomer,
  onSeeAll,
  onAvatar,
  onLanguage,
  language = 'pt-BR',
  isPro = false,
  canUpgrade = false,
  onUpgrade,
  attention = [],
  monthLabel = '',
  launched = 0,
  received = 0,
  stillToReceive = 0,
  evolution = [],
}: {
  userName?: string;
  initial?: string;
  formatCurrency: (value: number) => string;
  receivable: number;
  payable: number;
  overdue: number;
  overdueCustomers?: number;
  activeDebtors: number;
  onNewDebt: () => void;
  onReceive: () => void;
  onSplit: () => void;
  onNewCustomer: () => void;
  onOverdue?: () => void;
  onPayable?: () => void;
  onStatement?: () => void;
  onOpenCustomer?: (id: string) => void;
  onSeeAll?: () => void;
  onAvatar?: () => void;
  onLanguage?: () => void;
  language?: 'pt-BR' | 'en';
  isPro?: boolean;
  canUpgrade?: boolean;
  onUpgrade?: () => void;
  attention?: AttentionItem[];
  monthLabel?: string;
  launched?: number;
  received?: number;
  stillToReceive?: number;
  evolution?: Point[];
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [asking, setAsking] = useState(false);
  const money = (value: number) => (hidden ? '••••' : formatCurrency(value));
  const first = userName?.trim().split(/\s+/)[0] || 'olá';
  const letter = (initial || first).charAt(0).toUpperCase();

  const toggle = () => {
    setHidden((current) => {
      const next = !current;
      try {
        localStorage.setItem(HIDE_KEY, next ? '1' : '0');
      } catch {
        /* o aparelho pode bloquear o armazenamento */
      }
      return next;
    });
  };

  const iconFor = (kind: AttentionItem['kind']) => {
    if (kind === 'overdue') return AlertTriangle;
    if (kind === 'dueSoon') return Clock;
    return Undo2;
  };

  return (
    <div className="fp-home">
      <div className="fp-hello">
        <h2>Olá, {first}</h2>
        <button type="button" className="fp-eye" onClick={toggle} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}>
          {hidden ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
        </button>
        <div className="fp-hello-end">
          {onLanguage ? (
            <button type="button" className="fp-lang" onClick={onLanguage}>
              {language === 'pt-BR' ? 'PT' : 'EN'}
            </button>
          ) : null}
          <button type="button" className="fp-avatar" onClick={onAvatar} aria-label="Minha conta">
            {letter}
          </button>
        </div>
      </div>

      <div className={`fp-home-top${attention.length === 0 ? ' solo' : ''}`}>
        <div className="fp-home-left">
          <article className="fp-card fp-balance">
            <div className="fp-balance-grid">
              <div>
                <p>A receber</p>
                <strong>{money(receivable)}</strong>
                <span className="fp-debtors">{hidden ? '••••' : activeDebtorLabel(activeDebtors)}</span>
              </div>
              <div>
                <p>A pagar</p>
                <strong>{money(payable)}</strong>
              </div>
              <div>
                <p>Em atraso</p>
                <strong className="danger">{money(overdue)}</strong>
              </div>
            </div>
          </article>
          <div className="fp-shortcut-card">
            <div className="fp-shortcuts">
              <QuickAction icon={Plus} label="Nova dívida" onClick={onNewDebt} />
              <QuickAction icon={ArrowDownLeft} label="Receber" onClick={onReceive} />
              <QuickAction icon={SquareSplitHorizontal} label="Dividir conta" onClick={onSplit} />
              <QuickAction icon={UserPlus} label="Novo cliente" onClick={onNewCustomer} />
            </div>
          </div>
          {asking ? (
            <AiAsk isPro={isPro} canUpgrade={canUpgrade} onUpgrade={onUpgrade ?? (() => undefined)} />
          ) : (
            <button type="button" className="fp-ask-line" onClick={() => setAsking(true)}>
              <Sparkles size={16} strokeWidth={1.5} />
              <span>Pergunte à IA sobre suas contas</span>
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {attention.length > 0 ? (
          <article className="fp-card fp-attention">
            <div className="fp-card-head">
              <h2>Precisa da sua atenção</h2>
              <button type="button" onClick={onSeeAll}>
                Ver tudo
              </button>
            </div>
            {attention.map((item) => (
              <button key={item.customerId} type="button" className="fp-attention-row" onClick={() => onOpenCustomer?.(item.customerId)}>
                <IconCircle icon={iconFor(item.kind)} tone={item.kind === 'overdue' ? 'danger' : item.kind === 'dueSoon' ? 'warn' : 'ok'} />
                <span className="fp-list-grow">
                  <strong>{item.name}</strong>
                  <span>{item.reason}</span>
                </span>
                <span className={`fp-list-amt ${item.kind === 'overdue' ? 'danger' : item.kind === 'refund' ? 'in' : ''}`}>{money(item.amount)}</span>
              </button>
            ))}
          </article>
        ) : null}
      </div>

      {!isPro ? (
        <div className="fp-sponsor desk">
          <Sponsor />
        </div>
      ) : null}

      <div className="fp-home-bottom">
        <article className="fp-card fp-month">
          <div className="fp-card-head">
            <h2>
              <span className="fp-only-desk">Resumo de </span>
              {monthLabel}
            </h2>
            <button type="button" onClick={onStatement}>
              Ver extrato
            </button>
          </div>
          <div className="fp-month-nums">
            <div>
              <p>Lançado</p>
              <strong>{money(launched)}</strong>
            </div>
            <div>
              <p>Recebido</p>
              <strong className="in">{money(received)}</strong>
            </div>
            <div>
              <p>Falta receber</p>
              <strong>{money(stillToReceive)}</strong>
            </div>
          </div>
          <div className="fp-chart-mobile">
            <p className="fp-legend">Fiado e Recebido · últimos 14 dias</p>
            <Chart data={evolution} />
          </div>
        </article>
        <article className="fp-card fp-chart-desk">
          <div className="fp-card-head">
            <h2>Evolução</h2>
            <span>Últimos 14 dias</span>
          </div>
          <Chart data={evolution} />
        </article>
      </div>

      {!isPro ? (
        <div className="fp-sponsor mob">
          <Sponsor />
        </div>
      ) : null}
    </div>
  );
}
