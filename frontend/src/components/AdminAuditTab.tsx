import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from './adminApi';
import { BLOCK_REASON_LABEL } from './adminLabels';

const ACTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'user.block', label: 'Bloqueio' },
  { value: 'user.unblock', label: 'Desbloqueio' },
  { value: 'user.update', label: 'Alteração de cadastro' },
  { value: 'user.reset_password', label: 'Redefinição de senha' },
  { value: 'user.reactivate', label: 'Reativação' },
  { value: 'settings.update', label: 'Configuração' },
  { value: 'overview.export', label: 'Exportação da visão geral' },
  { value: 'grant.cortesia', label: 'Cortesia' },
  { value: 'grant.trial', label: 'Teste grátis' },
  { value: 'grant.cupom', label: 'Cupom' },
  { value: 'promotion.create', label: 'Promoção' },
];

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  ACTIONS.filter((item) => item.value).map((item) => [item.value, item.label]),
);

type AuditState = {
  is_active?: boolean;
  legal_hold?: boolean;
  block_reason?: string | null;
  reset?: boolean;
  key?: string;
  closed?: boolean;
  format?: string;
  preset?: string;
  from?: string;
  to?: string;
  type?: string | null;
  grant_plan?: string | null;
  grant_source?: string | null;
  grant_expires_at?: string | null;
  paid_plan?: string | null;
  paid_until?: string | null;
  plan?: string | null;
  audience?: string | null;
  expires_at?: string | null;
  user_count?: number;
};

interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  reason: string | null;
  note: string | null;
  before_state: AuditState | null;
  after_state: AuditState | null;
  admin_name: string | null;
  target_name: string | null;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function describeState(state: AuditState | null) {
  if (!state) return '—';
  if (state.reset !== undefined) return state.reset ? 'senha redefinida' : 'antes da redefinição';
  if (state.key) return `chave ${state.key}`;
  if (state.format) {
    const period = state.preset
      ? `atalho ${state.preset}`
      : `${state.from ?? '—'} a ${state.to ?? '—'}`;
    const kind = state.type ? state.type : 'todos os tipos';
    return `exportação ${state.format}, ${period}, ${kind}`;
  }
  if ('grant_plan' in state || 'grant_source' in state) {
    const until = state.grant_expires_at ? formatWhen(state.grant_expires_at) : 'sem prazo';
    const paid = state.paid_plan ? ` Plano pago: ${state.paid_plan}.` : '';
    return `${state.grant_plan ?? 'sem concessão'}, ${state.grant_source ?? '—'}, até ${until}.${paid}`;
  }
  if ('audience' in state || 'user_count' in state) {
    const until = state.expires_at ? formatWhen(state.expires_at) : '—';
    const who = state.audience === 'all' ? 'base inteira' : `${state.user_count ?? 0} pessoas`;
    return `${state.plan ?? '—'}, ${who}, até ${until}`;
  }
  const access = state.is_active ? 'livre' : 'bloqueado';
  const hold = state.legal_hold ? ', ordem judicial' : '';
  const reason = state.block_reason
    ? `, ${BLOCK_REASON_LABEL[state.block_reason] || state.block_reason}`
    : '';
  return `${access}${hold}${reason}`;
}

export const AdminAuditTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (action) params.set('action', action);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const data = await adminFetch<{ entries: AuditEntry[]; meta: { totalPages: number } }>(
        `/audit?${params.toString()}`,
      );
      setEntries(data.entries);
      setTotalPages(data.meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o registro');
    } finally {
      setLoading(false);
    }
  }, [action, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          load();
        }}
      >
        <select
          aria-label="Filtrar por ação"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
          }}
          className="fp-input max-w-xs"
        >
          {ACTIONS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          aria-label="De"
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          className="fp-input max-w-[11rem]"
        />
        <input
          aria-label="Até"
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          className="fp-input max-w-[11rem]"
        />
      </form>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="fp-card overflow-x-auto">
        {loading ? (
          <p className="text-slate-400 font-semibold py-16 text-center">Carregando...</p>
        ) : (
          <table className="fp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Admin</th>
                <th>Ação</th>
                <th>Alvo</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    className="cursor-pointer"
                    onClick={() => setOpenId((current) => (current === entry.id ? null : entry.id))}
                  >
                    <td>{formatWhen(entry.created_at)}</td>
                    <td className="font-bold text-slate-800">{entry.admin_name || '—'}</td>
                    <td>{ACTION_LABEL[entry.action] || entry.action}</td>
                    <td>{entry.target_name || '—'}</td>
                  </tr>
                  {openId === entry.id && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50">
                        <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div>
                            <dt className="font-bold text-slate-400">Motivo</dt>
                            <dd>
                              {entry.reason
                                ? BLOCK_REASON_LABEL[entry.reason] || entry.reason
                                : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-400">Observação</dt>
                            <dd>{entry.note || '—'}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-400">Antes</dt>
                            <dd>{describeState(entry.before_state)}</dd>
                          </div>
                          <div>
                            <dt className="font-bold text-slate-400">Depois</dt>
                            <dd>{describeState(entry.after_state)}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-10">
                    Nenhuma ação neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm font-semibold text-slate-500">
          <button
            type="button"
            className="fp-btn fp-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Anterior
          </button>
          <span>
            página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="fp-btn fp-btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};
