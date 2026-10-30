import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { downloadReport, sponsorFetch, type BoardRow } from './sponsorApi';
import { addDays, brDate, countLabel, percentLabel, saoPauloToday } from './sponsorLink';

type Day = { dia: string; exibicoes: number; cliques: number };
type ResultRow = { slot: string; plano: string; exibicoes: number; cliques: number; ctr: number };

function Chart({ days }: { days: Day[] }) {
  const maxView = Math.max(1, ...days.map((day) => day.exibicoes));
  const points = days
    .map((day, index) => {
      const x = days.length === 1 ? 50 : (index / (days.length - 1)) * 100;
      const y = 96 - (day.cliques / Math.max(1, ...days.map((item) => item.cliques))) * 88;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <div className="fp-mkt-chart" aria-label="Gráfico por dia">
      <div className="fp-mkt-bars">
        {days.map((day) => (
          <div key={day.dia} className="fp-mkt-bar" style={{ height: `${Math.max(2, (day.exibicoes / maxView) * 100)}%` }} title={brDate(day.dia)} />
        ))}
      </div>
      <svg className="fp-mkt-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" stroke="#2b2f77" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function MarketingResults() {
  const today = saoPauloToday();
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [contractId, setContractId] = useState('');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [days, setDays] = useState<Day[]>([]);
  const [table, setTable] = useState<ResultRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sponsorFetch<{ rows: BoardRow[] }>('/board')
      .then((data) => {
        const withContract = data.rows.filter((row) => row.contract_id);
        setRows(withContract);
        if (withContract[0]?.contract_id) setContractId(withContract[0].contract_id);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Não consegui carregar os contratos.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!contractId) return;
    let live = true;
    setError('');
    Promise.all([
      sponsorFetch<{ days: Day[] }>(`/contracts/${contractId}/daily?from=${from}&to=${to}`),
      sponsorFetch<{ results: ResultRow[] }>(`/contracts/${contractId}/results?from=${from}&to=${to}`),
    ])
      .then(([daily, results]) => {
        if (!live) return;
        setDays(daily.days);
        setTable(results.results);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Não consegui carregar os resultados.');
      });
    return () => {
      live = false;
    };
  }, [contractId, from, to]);

  const views = table.reduce((sum, row) => sum + row.exibicoes, 0);
  const clicks = table.reduce((sum, row) => sum + row.cliques, 0);
  const ctr = views > 0 ? clicks / views : 0;

  return (
    <div className="fp-mkt">
      {error ? <p className="fp-mkt-banner">{error}</p> : null}
      <div className="fp-mkt-toolbar">
        <label>
          Contrato
          <select aria-label="Contrato" value={contractId} onChange={(event) => setContractId(event.target.value)}>
            {rows.map((row) => (
              <option key={row.contract_id} value={row.contract_id || ''}>{row.nome}</option>
            ))}
          </select>
        </label>
        <label>
          De
          <input aria-label="Início do período" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Até
          <input aria-label="Fim do período" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <Button onClick={() => downloadReport(contractId, from, to).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não consegui gerar o PDF.'))} disabled={!contractId}>
          <Download size={16} /> Baixar PDF
        </Button>
      </div>
      {loading ? <p className="fp-mkt-loading">Carregando resultados...</p> : null}
      {!loading && rows.length === 0 && !error ? <p className="fp-mkt-empty">Nenhum contrato para mostrar ainda.</p> : null}
      {contractId ? (
        <>
          <div className="fp-mkt-stats">
            <article className="fp-mkt-card"><p>Exibições</p><strong>{countLabel(views)}</strong></article>
            <article className="fp-mkt-card"><p>Cliques</p><strong>{countLabel(clicks)}</strong><p>no link de destino</p></article>
            <article className="fp-mkt-card"><p>CTR</p><strong>{percentLabel(ctr)}</strong><p>cliques ÷ exibições</p></article>
          </div>
          <article className="fp-mkt-panel">
            <div className="fp-mkt-toolbar">
              <h3>Por dia</h3>
              <p className="fp-mkt-legend"><span className="fp-mkt-swatch" /> Exibições <span className="fp-mkt-swatch line" /> Cliques</p>
            </div>
            {days.length > 0 ? <Chart days={days} /> : <p className="fp-mkt-note">Sem dias neste período.</p>}
          </article>
          <article className="fp-mkt-panel">
            <h3>Por espaço e plano</h3>
            <table>
              <thead>
                <tr><th>Espaço</th><th>Plano</th><th>Exib.</th><th>Cliques</th><th>CTR</th></tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr key={`${row.slot}-${row.plano}`}>
                    <td>{row.slot === 'tela_cheia' ? 'Tela cheia' : 'Faixa'}</td>
                    <td>{row.plano === 'pro' ? 'Pro' : 'Free'}</td>
                    <td>{countLabel(row.exibicoes)}</td>
                    <td>{countLabel(row.cliques)}</td>
                    <td>{percentLabel(row.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fp-mkt-note">Só contagens. Nenhum dado de cliente entra no relatório.</p>
          </article>
        </>
      ) : null}
    </div>
  );
}
