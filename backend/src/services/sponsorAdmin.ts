import { query } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { insertAuditEntry, withTransaction } from './adminAudit.js';
import {
  planRenewal,
  saoPauloToday,
  transitionContract,
  type ContractStatus,
  type SponsorSlot,
} from '../domain/sponsors.js';

type Sql = (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

const SPONSOR_FIELDS = `id, nome, categoria, cidade, contato_nome, ativo, created_at, updated_at`;

function audit(
  sql: Sql,
  adminId: string,
  action: string,
  beforeState: Record<string, unknown>,
  afterState: Record<string, unknown>,
) {
  return insertAuditEntry(sql, {
    adminId,
    action,
    targetUserId: null,
    reason: null,
    note: null,
    beforeState,
    afterState,
    keepWhileOrderStands: false,
  });
}

function withoutContact(row: Record<string, unknown>) {
  const copy = { ...row };
  delete copy.contato_nome;
  delete copy.observacao;
  return copy;
}

async function expireDue(sql: Sql) {
  await sql(
    `UPDATE sponsor_contracts
        SET status = 'vencido', updated_at = NOW()
      WHERE status = 'ativo'
        AND fim < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
  );
}

export async function createSponsor(
  adminId: string,
  input: { nome: string; categoria: string; cidade: string; contato_nome: string | null },
) {
  return withTransaction(async (sql) => {
    const result = await sql(
      `INSERT INTO sponsors (nome, categoria, cidade, contato_nome)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SPONSOR_FIELDS}`,
      [input.nome, input.categoria, input.cidade, input.contato_nome],
    );
    const row = result.rows[0];
    await audit(sql, adminId, 'SPONSOR_CREATE', {}, withoutContact(row));
    return row;
  });
}

export async function updateSponsor(
  adminId: string,
  id: string,
  input: { nome: string; categoria: string; cidade: string; contato_nome: string | null; ativo: boolean },
) {
  return withTransaction(async (sql) => {
    const before = await sql(`SELECT ${SPONSOR_FIELDS} FROM sponsors WHERE id = $1`, [id]);
    if (!before.rows[0]) throw new ApiError(404, 'Patrocinador não encontrado.', 'NOT_FOUND');
    const result = await sql(
      `UPDATE sponsors
          SET nome = $2, categoria = $3, cidade = $4, contato_nome = $5, ativo = $6, updated_at = NOW()
        WHERE id = $1
        RETURNING ${SPONSOR_FIELDS}`,
      [id, input.nome, input.categoria, input.cidade, input.contato_nome, input.ativo],
    );
    await audit(sql, adminId, 'SPONSOR_UPDATE', withoutContact(before.rows[0]), withoutContact(result.rows[0]));
    return result.rows[0];
  });
}

export async function listSponsors() {
  const result = await query(
    `SELECT ${SPONSOR_FIELDS} FROM sponsors ORDER BY nome`,
  );
  return result.rows;
}

type ContractInput = {
  inicio: string;
  fim: string;
  planos_alvo: Array<'free' | 'pro'>;
  slots: SponsorSlot[];
  valor_centavos: number | null;
  observacao: string | null;
};

export async function createContract(adminId: string, sponsorId: string, input: ContractInput) {
  return withTransaction(async (sql) => {
    const sponsor = await sql(`SELECT id FROM sponsors WHERE id = $1`, [sponsorId]);
    if (!sponsor.rows[0]) throw new ApiError(404, 'Patrocinador não encontrado.', 'NOT_FOUND');
    const result = await sql(
      `INSERT INTO sponsor_contracts
         (sponsor_id, inicio, fim, planos_alvo, slots, valor_centavos, observacao, created_by)
       VALUES ($1, $2::date, $3::date, $4::text[], $5::text[], $6, $7, $8)
       RETURNING id, sponsor_id, inicio, fim, planos_alvo, slots, status, valor_centavos, renovado_de`,
      [
        sponsorId,
        input.inicio,
        input.fim,
        input.planos_alvo,
        input.slots,
        input.valor_centavos,
        input.observacao,
        adminId,
      ],
    );
    await audit(sql, adminId, 'SPONSOR_CONTRACT_CREATE', {}, withoutContact(result.rows[0]));
    return result.rows[0];
  });
}

async function loadContract(sql: Sql, id: string) {
  const result = await sql(
    `SELECT id, sponsor_id, inicio::text AS inicio, fim::text AS fim, planos_alvo, slots, status,
            valor_centavos, renovado_de
       FROM sponsor_contracts WHERE id = $1`,
    [id],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
  return result.rows[0];
}

async function applyAction(adminId: string, id: string, action: 'ativar' | 'pausar' | 'retomar' | 'cancelar') {
  return withTransaction(async (sql) => {
    await expireDue(sql);
    const before = await loadContract(sql, id);
    const today = saoPauloToday(new Date());
    let next: ContractStatus;
    try {
      next = transitionContract(before.status as ContractStatus, action, String(before.fim), today);
    } catch (error) {
      throw new ApiError(409, error instanceof Error ? error.message : 'Ação inválida.', 'CONFLICT');
    }
    const result = await sql(
      `UPDATE sponsor_contracts SET status = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, status, fim::text AS fim`,
      [id, next],
    );
    await audit(sql, adminId, `SPONSOR_CONTRACT_${action.toUpperCase()}`, withoutContact(before), result.rows[0]);
    return result.rows[0];
  });
}

export const pauseContract = (adminId: string, id: string) => applyAction(adminId, id, 'pausar');
export const resumeContract = (adminId: string, id: string) => applyAction(adminId, id, 'retomar');
export const cancelContract = (adminId: string, id: string) => applyAction(adminId, id, 'cancelar');
export const activateContract = (adminId: string, id: string) => applyAction(adminId, id, 'ativar');

export async function renewContract(adminId: string, id: string, input: ContractInput) {
  return withTransaction(async (sql) => {
    await expireDue(sql);
    const before = await loadContract(sql, id);
    const today = saoPauloToday(new Date());
    let status: 'ativo' | 'rascunho';
    try {
      status = planRenewal(before.status as ContractStatus, input.inicio, input.fim, today);
    } catch (error) {
      throw new ApiError(409, error instanceof Error ? error.message : 'Não foi possível renovar.', 'CONFLICT');
    }
    const created = await sql(
      `INSERT INTO sponsor_contracts
         (sponsor_id, inicio, fim, planos_alvo, slots, status, valor_centavos, observacao, renovado_de, created_by)
       VALUES ($1, $2::date, $3::date, $4::text[], $5::text[], $6, $7, $8, $9, $10)
       RETURNING id, sponsor_id, status, renovado_de, inicio::text AS inicio, fim::text AS fim`,
      [
        before.sponsor_id,
        input.inicio,
        input.fim,
        input.planos_alvo,
        input.slots,
        status,
        input.valor_centavos,
        input.observacao,
        id,
        adminId,
      ],
    );
    await sql(
      `INSERT INTO sponsor_creatives
         (contract_id, tipo, slot, media_url, media_origem, link_destino, titulo, texto_alt, ativo, ordem)
       SELECT $1, tipo, slot, media_url, media_origem, link_destino, titulo, texto_alt, ativo, ordem
         FROM sponsor_creatives
        WHERE contract_id = $2 AND ativo = TRUE`,
      [created.rows[0].id, id],
    );
    await audit(sql, adminId, 'SPONSOR_CONTRACT_RENEW', { id, status: before.status }, withoutContact(created.rows[0]));
    return created.rows[0];
  });
}

export async function createCreative(
  adminId: string,
  contractId: string,
  input: {
    tipo: 'imagem' | 'video';
    slot: SponsorSlot;
    media_url: string;
    link_destino: string;
    titulo: string;
    texto_alt: string;
    ordem: number;
  },
) {
  return withTransaction(async (sql) => {
    const contract = await sql(`SELECT id, slots FROM sponsor_contracts WHERE id = $1`, [contractId]);
    if (!contract.rows[0]) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
    const slots = contract.rows[0].slots as string[];
    if (!slots.includes(input.slot)) {
      throw new ApiError(400, 'O criativo precisa usar um espaço do contrato.', 'VALIDATION');
    }
    const result = await sql(
      `INSERT INTO sponsor_creatives
         (contract_id, tipo, slot, media_url, media_origem, link_destino, titulo, texto_alt, ordem)
       VALUES ($1, $2, $3, $4, 'link', $5, $6, $7, $8)
       RETURNING id, contract_id, tipo, slot, media_origem, titulo, ativo, ordem`,
      [
        contractId,
        input.tipo,
        input.slot,
        input.media_url,
        input.link_destino,
        input.titulo,
        input.texto_alt,
        input.ordem,
      ],
    );
    await audit(sql, adminId, 'SPONSOR_CREATIVE_CREATE', {}, result.rows[0]);
    return result.rows[0];
  });
}

export async function updateCreative(
  adminId: string,
  id: string,
  input: {
    tipo: 'imagem' | 'video';
    slot: SponsorSlot;
    media_url: string;
    link_destino: string;
    titulo: string;
    texto_alt: string;
  },
) {
  return withTransaction(async (sql) => {
    const current = await sql(
      `SELECT c.id, c.tipo, c.slot, c.titulo, k.status, k.slots
         FROM sponsor_creatives c
         JOIN sponsor_contracts k ON k.id = c.contract_id
        WHERE c.id = $1`,
      [id],
    );
    const row = current.rows[0];
    if (!row) throw new ApiError(404, 'Criativo não encontrado.', 'NOT_FOUND');
    if (row.status === 'vencido' || row.status === 'cancelado') {
      throw new ApiError(409, 'Contrato encerrado não troca de criativo. Renove.', 'OFF_AIR');
    }
    const slots = row.slots as string[];
    if (!slots.includes(input.slot)) {
      throw new ApiError(400, 'O criativo precisa usar um espaço do contrato.', 'VALIDATION');
    }
    const result = await sql(
      `UPDATE sponsor_creatives
          SET tipo = $2, slot = $3, media_url = $4, link_destino = $5,
              titulo = $6, texto_alt = $7, updated_at = NOW()
        WHERE id = $1
        RETURNING id, tipo, slot, titulo, ativo, ordem`,
      [id, input.tipo, input.slot, input.media_url, input.link_destino, input.titulo, input.texto_alt],
    );
    const safe = { id: row.id, tipo: row.tipo, slot: row.slot, titulo: row.titulo };
    const next = result.rows[0];
    await audit(sql, adminId, 'SPONSOR_CREATIVE_UPDATE', safe, {
      id: next.id,
      tipo: next.tipo,
      slot: next.slot,
      titulo: next.titulo,
    });
    return next;
  });
}

export async function contractResults(contractId: string, from: string, to: string) {
  const rows = await query(
    `SELECT slot, plano,
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'exibicao'), 0)::int AS exibicoes,
            COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'clique'), 0)::int AS cliques
       FROM sponsor_events
      WHERE contract_id = $1
        AND dia BETWEEN $2::date AND $3::date
      GROUP BY slot, plano
      ORDER BY slot, plano`,
    [contractId, from, to],
  );
  return rows.rows.map((row) => {
    const exibicoes = Number(row.exibicoes);
    const cliques = Number(row.cliques);
    return {
      slot: row.slot,
      plano: row.plano,
      exibicoes,
      cliques,
      ctr: exibicoes > 0 ? Math.round((cliques / exibicoes) * 10000) / 10000 : 0,
    };
  });
}
