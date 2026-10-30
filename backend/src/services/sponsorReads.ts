import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { saoPauloToday } from '../domain/sponsors.js';
import { contractResults } from './sponsorAdmin.js';

export const BOARD_SQL = `SELECT s.id AS sponsor_id, s.nome, s.categoria, s.cidade, s.ativo,
            k.id AS contract_id, k.inicio::text AS inicio, k.fim::text AS fim,
            k.planos_alvo, k.slots, k.status
       FROM sponsors s
       LEFT JOIN sponsor_contracts k ON k.sponsor_id = s.id
      ORDER BY s.nome, k.inicio NULLS LAST`;

export const SUMMARY_SPONSOR_SQL = `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ativo)::int AS ativos
       FROM sponsors`;

export const SUMMARY_DUE_SQL = `SELECT COUNT(*)::int AS vencendo
       FROM sponsor_contracts
      WHERE status = 'ativo'
        AND fim >= $1::date
        AND fim <= ($1::date + 7)`;

export const SUMMARY_EVENTS_SQL = `SELECT
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'exibicao'), 0)::int AS exibicoes,
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'clique'), 0)::int AS cliques
       FROM sponsor_events
      WHERE dia BETWEEN $1::date AND $2::date`;

export const DAILY_SQL = `SELECT dia::text AS dia,
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'exibicao'), 0)::int AS exibicoes,
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'clique'), 0)::int AS cliques
       FROM sponsor_events
      WHERE contract_id = $1
        AND dia BETWEEN $2::date AND $3::date
      GROUP BY dia
      ORDER BY dia`;

export const DETAIL_SQL = `SELECT k.id, k.sponsor_id, s.nome, s.categoria, s.cidade,
            s.contato_nome, s.ativo AS sponsor_ativo,
            k.inicio::text AS inicio, k.fim::text AS fim, k.planos_alvo, k.slots, k.status
       FROM sponsor_contracts k
       JOIN sponsors s ON s.id = k.sponsor_id
      WHERE k.id = $1`;

const CREATIVE_SQL = `SELECT id, tipo, slot, media_url, link_destino, titulo, texto_alt, ativo, ordem
       FROM sponsor_creatives
      WHERE contract_id = $1
      ORDER BY ordem, id`;

const REPORT_HEAD_SQL = `SELECT s.nome, k.inicio::text AS inicio, k.fim::text AS fim
       FROM sponsor_contracts k
       JOIN sponsors s ON s.id = k.sponsor_id
      WHERE k.id = $1`;

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function monthStart(iso: string, shift = 0): string {
  const [year, month] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + shift, 1)).toISOString().slice(0, 10);
}

export function monthEnd(iso: string, shift = 0): string {
  const [year, month] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month + shift, 0)).toISOString().slice(0, 10);
}

export function ratio(cliques: number, exibicoes: number): number {
  if (exibicoes <= 0) return 0;
  return Math.round((cliques / exibicoes) * 10000) / 10000;
}

export function fillDays(
  from: string,
  to: string,
  rows: Array<{ dia: string; exibicoes: number; cliques: number }>,
) {
  const found = new Map(rows.map((row) => [String(row.dia).slice(0, 10), row]));
  const days: Array<{ dia: string; exibicoes: number; cliques: number }> = [];
  for (let dia = from; dia <= to && days.length <= 366; dia = addDays(dia, 1)) {
    const row = found.get(dia);
    days.push({
      dia,
      exibicoes: row ? Number(row.exibicoes) : 0,
      cliques: row ? Number(row.cliques) : 0,
    });
  }
  return days;
}

function monthName(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso.slice(0, 7)}-01T12:00:00Z`),
  );
}

async function counts(from: string, to: string) {
  const result = await query(SUMMARY_EVENTS_SQL, [from, to]);
  const row = result.rows[0] || { exibicoes: 0, cliques: 0 };
  const exibicoes = Number(row.exibicoes);
  const cliques = Number(row.cliques);
  return { exibicoes, cliques, ctr: ratio(cliques, exibicoes) };
}

export async function sponsorBoard() {
  const result = await query(BOARD_SQL);
  return result.rows;
}

export async function sponsorSummary(now = new Date()) {
  const today = saoPauloToday(now);
  const from = monthStart(today);
  const previousFrom = monthStart(today, -1);
  const previousTo = monthEnd(today, -1);
  const [sponsors, due, current, previous] = await Promise.all([
    query(SUMMARY_SPONSOR_SQL),
    query(SUMMARY_DUE_SQL, [today]),
    counts(from, today),
    counts(previousFrom, previousTo),
  ]);
  const head = sponsors.rows[0] || { total: 0, ativos: 0 };
  return {
    patrocinadores_ativos: Number(head.ativos),
    patrocinadores_total: Number(head.total),
    vencendo_7: Number(due.rows[0]?.vencendo || 0),
    mes_nome: monthName(today),
    exibicoes: current.exibicoes,
    cliques: current.cliques,
    ctr: current.ctr,
    mes_anterior_nome: monthName(previousFrom),
    ctr_anterior: previous.exibicoes > 0 ? previous.ctr : null,
  };
}

export async function contractDetail(id: string) {
  const result = await query(DETAIL_SQL, [id]);
  if (!result.rows[0]) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
  const creatives = await query(CREATIVE_SQL, [id]);
  return { ...result.rows[0], creatives: creatives.rows };
}

export async function contractDaily(id: string, from: string, to: string) {
  const result = await query(DAILY_SQL, [id, from, to]);
  return fillDays(from, to, result.rows as Array<{ dia: string; exibicoes: number; cliques: number }>);
}

export async function contractReport(id: string, from: string, to: string) {
  const head = await query(REPORT_HEAD_SQL, [id]);
  if (!head.rows[0]) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
  const [rows, days] = await Promise.all([contractResults(id, from, to), contractDaily(id, from, to)]);
  return {
    nome: String(head.rows[0].nome),
    inicio: String(head.rows[0].inicio).slice(0, 10),
    fim: String(head.rows[0].fim).slice(0, 10),
    from,
    to,
    rows,
    days,
  };
}
