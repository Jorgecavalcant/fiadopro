import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Receipt,
  ShieldOff,
  Sparkles,
  UserRound,
  UserX,
  Users,
} from 'lucide-react';
import { adminDownload, adminFetch } from './adminApi';
import BrDateField from './BrDateField';

const PRESETS = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: '365', label: '12 meses' },
] as const;

const TYPES = [
  { id: '', label: 'Todos os tipos' },
  { id: 'DEBT', label: 'Fiado' },
  { id: 'PAYMENT', label: 'Pagamento' },
  { id: 'REFUND', label: 'Estorno' },
  { id: 'ABATIMENTO', label: 'Abatimento' },
] as const;

type Preset = (typeof PRESETS)[number]['id'];
type TxType = (typeof TYPES)[number]['id'];

interface Overview {
  from: string;
  to: string;
  preset: Preset | null;
  type: TxType | null;
  usuariosAtivos: number;
  clientes: number;
  lancamentos: number;
  volumeConfirmado: number;
  contasBloqueadas: number;
  contasEncerradas: number;
}

interface AppliedFilters {
  preset: Preset | null;
  from: string;
  to: string;
  type: TxType;
}

function formatCount(value: number) {
  return value.toLocaleString('pt-BR');
}

function formatVolume(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function filterQuery(filters: AppliedFilters) {
  const params = new URLSearchParams();
  if (filters.preset) params.set('preset', filters.preset);
  else {
    params.set('from', filters.from);
    params.set('to', filters.to);
  }
  if (filters.type) params.set('type', filters.type);
  return params.toString();
}

export const AdminOverviewTab: React.FC = () => {
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [applied, setApplied] = useState<AppliedFilters>({
    preset: '30',
    from: '',
    to: '',
    type: '',
  });
  const [report, setReport] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Overview>(`/overview?${filterQuery(applied)}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a visão geral');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  const exportFile = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    setError('');
    try {
      const blob = await adminDownload(`/overview/export?${filterQuery(applied)}&format=${format}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'pdf' ? 'visao-geral.pdf' : 'visao-geral.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar');
    } finally {
      setExporting(null);
    }
  };

  const cards = report
    ? [
        {
          label: 'Usuários ativos',
          value: formatCount(report.usuariosAtivos),
          sub: 'Contas criadas no período',
          accent: 'primary',
          icon: <Users className="w-4 h-4" />,
          iconBg: '#EEF2FF',
          iconColor: '#5967D8',
        },
        {
          label: 'Clientes',
          value: formatCount(report.clientes),
          sub: 'Cadastros no período',
          accent: 'success',
          icon: <UserRound className="w-4 h-4" />,
          iconBg: '#DCFCE7',
          iconColor: '#166534',
        },
        {
          label: 'Lançamentos',
          value: formatCount(report.lancamentos),
          sub: 'Movimentos no período',
          accent: 'primary',
          icon: <Receipt className="w-4 h-4" />,
          iconBg: '#F0F3FD',
          iconColor: '#4654C4',
        },
        {
          label: 'Volume confirmado',
          value: formatVolume(report.volumeConfirmado),
          sub: 'Soma já confirmada',
          accent: 'warning',
          icon: <BadgeDollarSign className="w-4 h-4" />,
          iconBg: '#FEF3C7',
          iconColor: '#92400E',
        },
        {
          label: 'Contas bloqueadas',
          value: formatCount(report.contasBloqueadas),
          sub: 'Bloqueio no período',
          accent: 'danger',
          icon: <ShieldOff className="w-4 h-4" />,
          iconBg: '#FEE2E2',
          iconColor: '#991B1B',
        },
        {
          label: 'Contas encerradas',
          value: formatCount(report.contasEncerradas),
          sub: 'Encerramento no período',
          accent: 'warning',
          icon: <UserX className="w-4 h-4" />,
          iconBg: '#F3E8FF',
          iconColor: '#6B21A8',
        },
      ]
    : [];

  return (
    <div className="space-y-4 min-w-0 w-full">
      <div className="fp-overview-filters" role="group" aria-label="Período">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`fp-btn ${applied.preset === item.id ? 'fp-btn-primary' : 'fp-btn-ghost'}`}
            onClick={() =>
              setApplied((current) => ({ ...current, preset: item.id, from: '', to: '' }))
            }
          >
            {item.label}
          </button>
        ))}
        <form
          className="fp-overview-filters"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draftFrom || !draftTo) {
              setError('Informe a data inicial e a data final.');
              return;
            }
            setApplied((current) => ({
              ...current,
              preset: null,
              from: draftFrom,
              to: draftTo,
            }));
          }}
        >
          <BrDateField
            className="fp-input"
            ariaLabel="Data inicial"
            value={draftFrom}
            onChange={setDraftFrom}
          />
          <BrDateField
            className="fp-input"
            ariaLabel="Data final"
            value={draftTo}
            onChange={setDraftTo}
          />
          <button type="submit" className="fp-btn fp-btn-ghost">
            Aplicar período
          </button>
        </form>
        <select
          className="fp-input"
          aria-label="Tipo de lançamento"
          value={applied.type}
          onChange={(event) =>
            setApplied((current) => ({ ...current, type: event.target.value as TxType }))
          }
        >
          {TYPES.map((item) => (
            <option key={item.id || 'todos'} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="fp-overview-filters">
        <button
          type="button"
          className="fp-btn fp-btn-primary"
          disabled={exporting !== null}
          onClick={() => exportFile('pdf')}
        >
          {exporting === 'pdf' ? 'Exportando...' : 'Exportar PDF'}
        </button>
        <button
          type="button"
          className="fp-btn fp-btn-primary"
          disabled={exporting !== null}
          onClick={() => exportFile('xlsx')}
        >
          {exporting === 'xlsx' ? 'Exportando...' : 'Exportar planilha'}
        </button>
        <button type="button" className="fp-btn fp-btn-ghost" disabled title="Em breve">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Analisar com IA
        </button>
      </div>

      {error && <p className="text-red-600 font-semibold text-sm">{error}</p>}
      {loading && <p className="text-slate-400 font-semibold text-sm">Carregando...</p>}
      {report && (
        <p className="text-slate-400 font-semibold text-sm">
          {report.from} a {report.to}
          {report.type ? ` · ${report.type}` : ' · todos os tipos'}
        </p>
      )}

      <div className="fp-kpi-grid">
        {cards.map((card) => (
          <div key={card.label} className={`fp-stat-card fp-kpi-card ${card.accent}`}>
            <div className="fp-kpi-head">
              <div
                className="fp-kpi-icon"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
              <span className="fp-kpi-label">{card.label}</span>
            </div>
            <div className="fp-kpi-value" title={card.value}>
              {card.value}
            </div>
            <div className="fp-kpi-sub">{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
