import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { readUserPlan } from './plans.js';
import {
  consumeRate,
  contractIsLive,
  decideSlot,
  eventAllowed,
  metricPlan,
  pickCreative,
  pruneOnceKeys,
  saoPauloToday,
  saoPauloTurn,
  toPublicCreative,
  type PublicCreative,
  type SponsorPlan,
  type SponsorSlot,
} from '../domain/sponsors.js';

type Candidate = PublicCreative & { ordem: number; exibicoesHoje: number };

const rates = new Map<string, { n: number; reset: number }>();
const once = new Set<string>();

export function resetSponsorLimits() {
  rates.clear();
  once.clear();
}

async function housekeeping() {
  await query(
    `UPDATE sponsor_contracts
        SET status = 'vencido', updated_at = NOW()
      WHERE status = 'ativo'
        AND fim < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
  );
  await query(
    `DELETE FROM sponsor_fullscreen_seen
      WHERE dia < ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 7)`,
  );
}

function dateOnly(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export async function nextCreative(
  userId: string,
  slot: SponsorSlot,
  now = new Date(),
): Promise<PublicCreative | null> {
  await housekeeping();
  const { plan, confirmed } = await readUserPlan(userId);
  if (decideSlot(plan, confirmed, slot) !== slot) return null;

  const today = saoPauloToday(now);
  const planFilter = confirmed ? metricPlan(plan, true) : null;
  const result = await query(
    `SELECT c.id, c.tipo, c.media_url, c.link_destino, c.titulo, c.texto_alt,
            s.nome AS patrocinador, c.ordem,
            COALESCE(e.quantidade, 0)::int AS exibicoes_hoje
       FROM sponsor_creatives c
       JOIN sponsor_contracts k ON k.id = c.contract_id
       JOIN sponsors s ON s.id = k.sponsor_id
       LEFT JOIN sponsor_events e
         ON e.creative_id = c.id
        AND e.contract_id = k.id
        AND e.tipo = 'exibicao'
        AND e.slot = c.slot
        AND e.plano = $3
        AND e.dia = $4::date
      WHERE s.ativo = TRUE
        AND c.ativo = TRUE
        AND k.status = 'ativo'
        AND k.inicio <= $4::date
        AND k.fim >= $4::date
        AND c.slot = $1
        AND $1 = ANY (k.slots)
        AND ($2::text IS NULL OR $2 = ANY (k.planos_alvo))`,
    [slot, planFilter, planFilter ?? 'free', today],
  );
  const chosen = pickCreative(
    result.rows.map((row) => ({
      id: String(row.id),
      tipo: row.tipo as PublicCreative['tipo'],
      media_url: String(row.media_url),
      link_destino: String(row.link_destino),
      titulo: String(row.titulo),
      texto_alt: String(row.texto_alt),
      patrocinador: String(row.patrocinador),
      ordem: Number(row.ordem),
      exibicoesHoje: Number(row.exibicoes_hoje),
    })) as Candidate[],
  );
  if (!chosen) return null;

  if (slot === 'tela_cheia') {
    const mark = await query(
      `INSERT INTO sponsor_fullscreen_seen (user_id, dia, turno)
       VALUES ($1, $2::date, $3)
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [userId, today, saoPauloTurn(now)],
    );
    if (mark.rows.length === 0) return null;
  }
  return toPublicCreative(chosen);
}

export async function recordEvent(
  userId: string,
  creativeId: string,
  tipo: 'exibicao' | 'clique',
  now = new Date(),
): Promise<{ counted: boolean }> {
  const today = saoPauloToday(now);
  pruneOnceKeys(once, today);
  const key = `${userId}|${creativeId}|${tipo}|${today}`;
  if (once.has(key)) return { counted: false };
  if (!consumeRate(rates, userId, now.getTime(), 30, 60_000)) {
    throw new ApiError(429, 'Muitos eventos. Tente de novo em instantes.', 'RATE_LIMIT');
  }
  await housekeeping();
  const { plan, confirmed } = await readUserPlan(userId);
  if (!confirmed) {
    throw new ApiError(503, 'Não foi possível confirmar o plano agora.', 'PLAN_UNCONFIRMED');
  }
  const countedAs = metricPlan(plan, true);
  if (!countedAs) {
    throw new ApiError(409, 'Seu plano não recebe este anúncio.', 'OFF_AIR');
  }

  const found = await query(
    `SELECT c.slot, c.ativo AS creative_ativo, c.contract_id,
            k.status, k.inicio, k.fim, s.ativo AS sponsor_ativo
       FROM sponsor_creatives c
       JOIN sponsor_contracts k ON k.id = c.contract_id
       JOIN sponsors s ON s.id = k.sponsor_id
      WHERE c.id = $1`,
    [creativeId],
  );
  const row = found.rows[0];
  if (!row) throw new ApiError(404, 'Anúncio não encontrado.', 'NOT_FOUND');

  const slot = row.slot as SponsorSlot;
  const live = contractIsLive({
    status: row.status,
    inicio: dateOnly(row.inicio),
    fim: dateOnly(row.fim),
    sponsorAtivo: row.sponsor_ativo === true,
    creativeAtivo: row.creative_ativo === true,
    today,
  });
  let fullscreenDelivered = slot !== 'tela_cheia';
  if (slot === 'tela_cheia') {
    const seen = await query(
      `SELECT 1 FROM sponsor_fullscreen_seen
        WHERE user_id = $1 AND dia = $2::date AND turno = $3`,
      [userId, today, saoPauloTurn(now)],
    );
    fullscreenDelivered = seen.rows.length > 0;
  }
  if (
    !eventAllowed({
      live,
      slot,
      plan,
      confirmed,
      fullscreenDelivered,
    })
  ) {
    throw new ApiError(409, 'Este anúncio não está no ar.', 'OFF_AIR');
  }

  await query(
    `INSERT INTO sponsor_events (creative_id, contract_id, tipo, slot, plano, dia, quantidade)
     VALUES ($1, $2, $3, $4, $5, $6::date, 1)
     ON CONFLICT (creative_id, contract_id, tipo, slot, plano, dia)
     DO UPDATE SET quantidade = sponsor_events.quantidade + 1`,
    [creativeId, row.contract_id, tipo, slot, countedAs satisfies SponsorPlan, today],
  );
  once.add(key);
  return { counted: true };
}
