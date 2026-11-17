import { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowRight, Bell, Clock, Eye, EyeOff, Plus, Sparkles, SquareSplitHorizontal, Undo2, UserPlus } from 'lucide-react';
import { HomeFull, HomeStrip, useHomeAds, type AdPlan } from './HomeAds';
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
          <Bar dataKey="Offered" name="Me devem" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Received" name="Me pagaram" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HomePanel({
  userName,
  initial,
  formatCurrency,
  receivable,
  receivedTotal = 0,
  overdue,
  activeDebtors,
  onNewDebt,
  onReceive,
  onSplit,
  onNewCustomer,
  onReceivable,
  onReceived,
  onOverdue,
  onStatement,
  onOpenCustomer,
  onSeeAll,
  onAvatar,
  onLanguage,
  notificationCount,
  onNotifications,
  language = 'pt-BR',
  isPro = false,
  adPlan,
  flowOpen = false,
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
  /** Soma de PAYMENT confirmados (não é saldo a devolver). */
  receivedTotal?: number;
  overdue: number;
  overdueCustomers?: number;
  activeDebtors: number;
  onNewDebt: () => void;
  onReceive: () => void;
  onSplit: () => void;
  onNewCustomer: () => void;
  onReceivable?: () => void;
  onReceived?: () => void;
  onOverdue?: () => void;
  onStatement?: () => void;
  onOpenCustomer?: (id: string) => void;
  onSeeAll?: () => void;
  onAvatar?: () => void;
  onLanguage?: () => void;
  notificationCount?: number;
  onNotifications?: () => void;
  language?: 'pt-BR' | 'en';
  isPro?: boolean;
  adPlan?: AdPlan;
  flowOpen?: boolean;
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
  const ads = useHomeAds(adPlan ?? (isPro ? 'pro' : 'free'), flowOpen);
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
          <button type="button" className="fp-bell" onClick={onNotifications} aria-label="Notificações">
            <Bell size={18} strokeWidth={1.5} />
            {notificationCount && notificationCount > 0 ? (
              <span className="fp-bell-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
            ) : null}
          </button>
          <button type="button" className="fp-avatar" onClick={onAvatar} aria-label="Minha conta">
            {letter}
          </button>
        </div>
      </div>

      <div className={`fp-home-top${attention.length === 0 ? ' solo' : ''}`}>
        <div className="fp-home-left">
          <div className="fp-balance-grid">
            <button
              type="button"
              className="fp-card fp-balance-tile"
              onClick={onReceivable}
              aria-label="Me devem"
              title="Me devem"
            >
              <p>Me devem</p>
              <strong className="fp-amt-debt">{money(receivable)}</strong>
              <span className="fp-debtors">{hidden ? '••••' : activeDebtorLabel(activeDebtors)}</span>
            </button>
            <button
              type="button"
              className="fp-card fp-balance-tile"
              onClick={onReceived}
              aria-label="Recebi"
              title="Recebi"
            >
              <p>Recebi</p>
              <strong className="fp-amt-paid">{money(receivedTotal)}</strong>
            </button>
            <button
              type="button"
              className="fp-card fp-balance-tile"
              onClick={onOverdue}
              aria-label="Em atraso"
              title="Em atraso"
            >
              <p>Em atraso</p>
              <strong className="danger">{money(overdue)}</strong>
            </button>
          </div>
          <div className="fp-shortcut-card">
            <div className="fp-shortcuts">
              <QuickAction icon={Plus} label="Me deve" tone="debt" onClick={onNewDebt} />
              <QuickAction icon={ArrowDownLeft} label="Me pagaram" tone="paid" onClick={onReceive} />
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

      {ads.creative ? (
        <div className="fp-sponsor-slot desk">
          <HomeStrip creative={ads.creative} quiet={ads.quiet} onHide={ads.hideStrip} />
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
              <p>Me devem</p>
              <strong className="fp-amt-debt">{money(launched)}</strong>
            </div>
            <div>
              <p>Me pagaram</p>
              <strong className="fp-amt-paid">{money(received)}</strong>
            </div>
            <div>
              <p>Falta receber</p>
              <strong>{money(stillToReceive)}</strong>
            </div>
          </div>
          <div className="fp-chart-mobile">
            <p className="fp-legend">Me devem e Me pagaram · últimos 14 dias</p>
            <Chart data={evolution} />
          </div>
          <div className="fp-month-fill">
            <div className="fp-month-nums">
              <div>
                <p>Em atraso</p>
                <strong className="danger">{money(overdue)}</strong>
              </div>
              <div>
                <p>Devedores</p>
                <strong>{hidden ? '••••' : activeDebtorLabel(activeDebtors)}</strong>
              </div>
            </div>
            <div
              className="fp-progress"
              role="img"
              aria-label="Me pagaram sobre Me devem"
            >
              <span
                style={{
                  width: `${launched > 0 ? Math.min(100, (received / launched) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="fp-legend">Me pagaram sobre Me devem</p>
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

      {ads.creative ? (
        <div className="fp-sponsor-slot mob">
          <HomeStrip creative={ads.creative} quiet={ads.quiet} onHide={ads.hideStrip} />
        </div>
      ) : null}
      {ads.full ? <HomeFull creative={ads.full} onClose={ads.dismissFull} onHide={ads.hideFull} /> : null}
    </div>
  );
}
