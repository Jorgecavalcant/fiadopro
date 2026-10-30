import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { sponsorFetch, type BoardRow, type Summary } from './sponsorApi';
import { brDate, countLabel, daysUntil, percentLabel, saoPauloToday } from './sponsorLink';

const STATUS: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'fp-badge fp-badge-success' },
  pausado: { label: 'Pausado', className: 'fp-badge fp-badge-warning' },
  rascunho: { label: 'Rascunho', className: 'fp-badge fp-badge-muted' },
  vencido: { label: 'Vencido', className: 'fp-badge fp-badge-danger' },
  cancelado: { label: 'Cancelado', className: 'fp-badge fp-badge-muted' },
};

function plans(value: string[] | null): string {
  if (!value?.length) return '—';
  return value.map((item) => (item === 'pro' ? 'Pro' : 'Free')).join(' + ');
}

function slots(value: string[] | null): string {
  if (!value?.length) return '—';
  return value.map((item) => (item === 'tela_cheia' ? 'Tela cheia' : 'Faixa')).join(' + ');
}

function aside(row: BoardRow, today: string): string {
  if (!row.contract_id || !row.status) return 'sem contrato';
  if (row.status === 'pausado') return 'pausado por você';
  if (row.status === 'rascunho' && row.inicio && row.inicio > today) return `começa ${brDate(row.inicio).slice(0, 5)}`;
  if (row.status === 'ativo' && row.fim) {
    const left = daysUntil(row.fim, today);
    if (left <= 7) return left <= 0 ? 'vence hoje' : `vence em ${left} dias`;
    return `em ${left} dias`;
  }
  return '';
}

function RowBody({ row, today }: { row: BoardRow; today: string }) {
  const status = STATUS[row.status || ''] || { label: 'Sem contrato', className: 'fp-badge fp-badge-muted' };
  const hint = aside(row, today);
  return (
    <>
      <div>
        <span className="fp-mkt-name">{row.nome}</span>
        <span className="fp-mkt-meta">{row.categoria} · {row.cidade}</span>
      </div>
      <span>{row.inicio && row.fim ? `${brDate(row.inicio)} – ${brDate(row.fim)}` : '—'}</span>
      <span>{plans(row.planos_alvo)}</span>
      <span>{slots(row.slots)}</span>
      <span className={status.className}>{status.label}</span>
      {row.status === 'vencido' ? <span className="fp-mkt-due">Renovar</span> : <span className={hint.startsWith('vence') ? 'fp-mkt-due' : 'fp-mkt-meta'}>{hint}</span>}
    </>
  );
}

export function MarketingOverview({
  onOpen,
  onCreate,
}: {
  onOpen: (row: BoardRow) => void;
  onCreate: () => void;
}) {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = saoPauloToday();

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    Promise.all([
      sponsorFetch<{ rows: BoardRow[] }>('/board'),
      sponsorFetch<{ summary: Summary }>('/summary'),
    ])
      .then(([board, card]) => {
        if (!live) return;
        setRows(board.rows);
        setSummary(card.summary);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Não consegui carregar o marketing.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const visible = rows.filter((row) => {
    const hay = `${row.nome} ${row.categoria} ${row.cidade}`.toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });
  const delta =
    summary && summary.ctr_anterior != null
      ? `${summary.ctr >= summary.ctr_anterior ? '↑' : '↓'} ${percentLabel(Math.abs(summary.ctr - summary.ctr_anterior)).replace('%', '')} p.p. vs ${summary.mes_anterior_nome}`
      : '';

  return (
    <div className="fp-mkt">
      {error ? <p className="fp-mkt-banner">{error}</p> : null}
      {loading ? <p className="fp-mkt-loading">Carregando o marketing...</p> : null}
      {!loading && !error && summary ? (
        <div className="fp-mkt-cards">
          <article className="fp-mkt-card">
            <p>Patrocinadores ativos</p>
            <strong>{summary.patrocinadores_ativos}</strong>
            <p>de {summary.patrocinadores_total} cadastrados</p>
          </article>
          <article className="fp-mkt-card">
            <p>Vencendo em 7 dias</p>
            <strong>{summary.vencendo_7}</strong>
            <p>só você renova</p>
          </article>
          <article className="fp-mkt-card">
            <p>Exibições em {summary.mes_nome}</p>
            <strong>{countLabel(summary.exibicoes)}</strong>
            <p>cliques: {countLabel(summary.cliques)}</p>
          </article>
          <article className="fp-mkt-card">
            <p>CTR do mês</p>
            <strong>{percentLabel(summary.ctr)}</strong>
            {delta ? <em>{delta}</em> : null}
          </article>
        </div>
      ) : null}
      <div className="fp-mkt-toolbar">
        <div>
          <h3>Patrocinadores e contratos</h3>
          <p className="fp-mkt-note">Contrato vence sozinho na data final. Renovar cria um contrato novo.</p>
        </div>
        <div className="fp-mkt-tools">
          <label className="fp-mkt-tools">
            <Search size={16} aria-hidden="true" />
            <input className="fp-mkt-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar patrocinador" aria-label="Buscar patrocinador" />
          </label>
          <Button onClick={onCreate}><Plus size={16} /> Novo patrocinador</Button>
        </div>
      </div>
      {!loading && !error && visible.length === 0 ? (
        <p className="fp-mkt-empty">Nenhum patrocinador ainda. Cadastre o primeiro.</p>
      ) : null}
      {visible.length > 0 ? (
        <>
          <div className="fp-mkt-table">
            <table>
              <thead>
                <tr>
                  <th>Patrocinador</th>
                  <th>Período</th>
                  <th>Planos</th>
                  <th>Espaços</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.sponsor_id}-${row.contract_id || 'novo'}`} onClick={() => onOpen(row)}>
                    <td><span className="fp-mkt-name">{row.nome}</span><span className="fp-mkt-meta">{row.categoria} · {row.cidade}</span></td>
                    <td>{row.inicio && row.fim ? `${brDate(row.inicio)} – ${brDate(row.fim)}` : '—'}</td>
                    <td>{plans(row.planos_alvo)}</td>
                    <td>{slots(row.slots)}</td>
                    <td><span className={(STATUS[row.status || ''] || STATUS.cancelado).className}>{(STATUS[row.status || ''] || { label: 'Sem contrato' }).label}</span></td>
                    <td>{row.status === 'vencido' ? <span className="fp-mkt-due">Renovar</span> : <span className={aside(row, today).startsWith('vence') ? 'fp-mkt-due' : ''}>{aside(row, today)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fp-mkt-cards-list">
            {visible.map((row) => (
              <button type="button" className="fp-mkt-mini" key={`card-${row.sponsor_id}-${row.contract_id || 'novo'}`} onClick={() => onOpen(row)}>
                <RowBody row={row} today={today} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
