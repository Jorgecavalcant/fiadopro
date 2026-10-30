import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Minus, Undo2, type LucideIcon } from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { esc } from '../utils/escapeHtml';
import { formatBrDate, formatBrDateTime } from '../utils/formatBr';
import { periodRange, periodToReceive, sumConfirmed, type PeriodPreset } from '../utils/ledgerPeriod';
import BrDateField from './BrDateField';
import { Chip } from './ui/Chip';
import { EmptyState } from './ui/EmptyState';
import { IconCircle } from './ui/IconCircle';
import { SearchField } from './ui/SearchField';

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'custom', label: 'Personalizado' },
];

const TYPES = [
  { id: 'ALL', label: 'Todos' },
  { id: 'DEBT', label: 'Dívidas' },
  { id: 'PAYMENT', label: 'Pagamentos' },
  { id: 'REFUND', label: 'Devoluções' },
  { id: 'ABATIMENTO', label: 'Abatimentos' },
] as const;

function typeIcon(type: string): LucideIcon {
  if (type === 'PAYMENT') return ArrowDownLeft;
  if (type === 'REFUND') return Undo2;
  if (type === 'ABATIMENTO') return Minus;
  return ArrowUpRight;
}

function amountColor(type: string): string {
  if (type === 'PAYMENT' || type === 'ABATIMENTO') return 'var(--fp-in)';
  return 'var(--fp-danger)';
}

export function StatementView({
  transactions,
  customers,
  formatCurrency,
}: {
  transactions: Transaction[];
  customers: Customer[];
  formatCurrency: (value: number) => string;
}) {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPES)[number]['id']>('ALL');
  const [query, setQuery] = useState('');

  const names = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.name])), [customers]);
  const range = periodRange(preset, Date.now(), { from: fromDate, to: toDate });
  const inPeriod = transactions.filter(
    (tx) => tx.status === 'CONFIRMED' && tx.timestamp >= range.from && tx.timestamp <= range.to,
  );
  const sums = sumConfirmed(inPeriod);
  const toReceive = periodToReceive(sums);
  const needle = query.trim().toLowerCase();
  const visible = inPeriod
    .filter((tx) => (typeFilter === 'ALL' ? true : tx.type === typeFilter))
    .filter((tx) => {
      if (!needle) return true;
      return (names.get(tx.customerId) ?? '').toLowerCase().includes(needle);
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const groups = new Map<string, Transaction[]>();
  for (const tx of visible) {
    const key = formatBrDate(tx.timestamp);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const cards = [
    { label: 'Lançado', value: sums.debt },
    { label: 'Recebido', value: sums.payment },
    { label: 'Devolvido', value: sums.refund },
    { label: 'Abatido', value: sums.abatement },
    { label: 'A receber no período', value: toReceive, hint: 'Quanto do que foi lançado no período ainda não voltou' },
  ];

  const downloadPdf = () => {
    const periodLabel = `${formatBrDate(range.from)} a ${formatBrDate(range.to)}`;
    const summary = cards
      .map(
        (card) =>
          `<div><span>${esc(card.label)}</span><strong>${esc(formatCurrency(card.value))}</strong></div>`,
      )
      .join('');
    const body = visible
      .map((tx) => {
        const when = formatBrDateTime(tx.timestamp);
        return `<tr><td>${esc(when)}</td><td>${esc(names.get(tx.customerId) ?? 'Cliente')}</td><td>${esc(tx.description || 'Lançamento')}</td><td style="text-align:right;color:${amountColor(tx.type)}">${esc(formatCurrency(tx.amount))}</td></tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc('Fiado Pro — Extrato geral')}</title>
<style>body{font-family:-apple-system,sans-serif;padding:32px;color:#1a1a1a}h1{font-size:22px;font-weight:600;color:#2b2f77}p{color:#5c5c5c}.sum{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}.sum div{background:#f6f6f4;border-radius:10px;padding:12px 14px}.sum span{display:block;font-size:12px}.sum strong{font-size:16px}table{width:100%;border-collapse:collapse}td{padding:8px 6px;border-bottom:1px solid #e6e6e2;font-size:13px}</style></head>
<body><h1>Fiado Pro — Extrato geral</h1><p>Período: ${esc(periodLabel)}</p><div class="sum">${summary}</div>
<table>${body}</table><p>Gerado em ${esc(formatBrDateTime(Date.now()))}</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const win = window.open(url, '_blank');
    if (!win) alert('Ative popups no navegador para baixar o PDF.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PRESETS.map((item) => (
          <Chip key={item.id} label={item.label} selected={preset === item.id} onClick={() => setPreset(item.id)} />
        ))}
      </div>
      {preset === 'custom' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <BrDateField value={fromDate} onChange={setFromDate} ariaLabel="Data inicial" />
          <BrDateField value={toDate} onChange={setToDate} ariaLabel="Data final" />
        </div>
      ) : null}
      <div className="fp-stat-grid">
        {cards.map((card) => (
          <article key={card.label} className="fp-card" style={{ padding: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--fp-muted)' }}>{card.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--fp-text)' }}>
              {formatCurrency(card.value)}
            </p>
            {card.hint ? <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 400, color: 'var(--fp-muted)' }}>{card.hint}</p> : null}
          </article>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TYPES.map((item) => (
          <Chip key={item.id} label={item.label} selected={typeFilter === item.id} onClick={() => setTypeFilter(item.id)} />
        ))}
      </div>
      <SearchField value={query} onChange={setQuery} label="Buscar cliente" />
      <button type="button" className="fp-btn fp-btn-secondary fp-btn-block" onClick={downloadPdf}>
        Baixar PDF
      </button>
      {visible.length === 0 ? (
        <EmptyState text="Nenhuma movimentação neste período" />
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--fp-muted)' }}>{day}</p>
            <div className="fp-list">
              {list.map((tx) => {
                const when = formatBrDateTime(tx.timestamp);
                const hour = when.split(' ')[1] ?? '';
                return (
                  <div key={tx.id} className="fp-list-row" style={{ cursor: 'default' }}>
                    <IconCircle icon={typeIcon(tx.type)} />
                    <span className="fp-list-grow">
                      <strong>{names.get(tx.customerId) ?? 'Cliente'}</strong>
                      <span>
                        {tx.description || 'Lançamento'} · {hour}
                      </span>
                    </span>
                    <span className="fp-list-amt" style={{ color: amountColor(tx.type) }}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
