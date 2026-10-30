import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { query } from '../config/database.js';
import { TECH42 } from '../domain/sponsorParty.js';
import { saoPauloToday } from '../domain/sponsors.js';
import { ApiError } from '../middleware/errorHandler.js';
import { insertAuditEntry, withTransaction } from './adminAudit.js';

export type ContractSnapshot = {
  conteudo_sha256: string;
  qualificacao: string;
  assinatura: string;
  inicio: string;
  fim: string;
  planos: string;
  espacos: string;
  valor: string;
  pagamento: string;
  parcelas: string;
  dia_vencimento: string;
  aviso_previo_dias: string;
  criativos: string;
};

const TEMPLATE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../templates/contrato-patrocinio.md'),
  'utf8',
);

const PAYMENT: Record<string, string> = {
  pix: 'Pix',
  boleto: 'boleto',
  transferencia: 'transferência',
};

function brDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sha(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fillContract(snapshot: ContractSnapshot, generatedOn: string): string {
  const fields: Record<string, string> = {
    CONTRATANTE_QUALIFICACAO: snapshot.qualificacao,
    CONTRATANTE_ASSINATURA: snapshot.assinatura,
    CONTRATADA_RAZAO: TECH42.razao,
    CONTRATADA_FANTASIA: TECH42.fantasia,
    CONTRATADA_CNPJ: TECH42.cnpj,
    CONTRATADA_ENDERECO: TECH42.endereco,
    CONTRATADA_CIDADE: TECH42.cidade,
    CONTRATADA_UF: TECH42.uf,
    INICIO: brDate(snapshot.inicio),
    FIM: brDate(snapshot.fim),
    PLANOS: snapshot.planos,
    ESPACOS: snapshot.espacos,
    VALOR: snapshot.valor,
    PAGAMENTO: snapshot.pagamento,
    PARCELAS: snapshot.parcelas,
    DIA_VENCIMENTO: snapshot.dia_vencimento,
    AVISO_PREVIO_DIAS: snapshot.aviso_previo_dias,
    CIDADE_ASSINATURA: TECH42.cidade,
    DATA_GERACAO: brDate(generatedOn),
  };
  return TEMPLATE.split('\n')
    .filter((line) => !line.startsWith('<!--'))
    .join('\n')
    .replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => fields[key] ?? '');
}

export function buildSnapshot(input: {
  qualificacao: string;
  assinatura: string;
  inicio: string;
  fim: string;
  planos: string;
  espacos: string;
  valorCentavos: number;
  pagamento: string;
  parcelas: number;
  diaVencimento: number;
  avisoPrevioDias: number;
  criativos: string;
}): ContractSnapshot {
  const body = {
    qualificacao: input.qualificacao,
    assinatura: input.assinatura,
    inicio: input.inicio,
    fim: input.fim,
    planos: input.planos,
    espacos: input.espacos,
    valor: money(input.valorCentavos),
    pagamento: PAYMENT[input.pagamento] || input.pagamento,
    parcelas: String(input.parcelas),
    dia_vencimento: String(input.diaVencimento).padStart(2, '0'),
    aviso_previo_dias: String(input.avisoPrevioDias),
    criativos: input.criativos,
  };
  return { ...body, conteudo_sha256: sha(JSON.stringify(body)) };
}

export function renderContractPdf(text: string, versao: number, generatedOn: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.fillColor('#2b2f77').font('Helvetica-Bold').fontSize(16).text('Fiado Pro');
    doc.fillColor('#444444').font('Helvetica').fontSize(10).text('Tech 42');
    doc.moveDown();
    doc.fillColor('#111111').fontSize(11);
    for (const paragraph of text.split('\n')) {
      if (!paragraph.trim()) {
        doc.moveDown(0.4);
        continue;
      }
      const title = paragraph.startsWith('CONTRATO') || /^\d+\./.test(paragraph);
      doc.font(title ? 'Helvetica-Bold' : 'Helvetica').text(paragraph, { lineGap: 2 });
    }
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(index);
      doc.font('Helvetica').fontSize(8).fillColor('#666666').text(
        `Fiado Pro · versão ${versao} · ${brDate(generatedOn)} · página ${index + 1} de ${range.count}`,
        56,
        doc.page.height - 40,
        { lineBreak: false },
      );
    }
    doc.end();
  });
}

type Loaded = {
  qualificacao: string;
  assinatura: string;
  inicio: string;
  fim: string;
  planos_alvo: string[];
  slots: string[];
  valor_centavos: number | null;
  forma_pagamento: string | null;
  parcelas: number | null;
  dia_vencimento: number | null;
  aviso_previo_dias: number | null;
  criativos: string;
};

async function loadContract(contractId: string): Promise<Loaded> {
  const head = await query(
    `SELECT s.tipo_pessoa, s.nome, s.razao_social, s.documento, s.endereco, s.cidade, s.uf,
            s.representante_nome, s.representante_cargo, s.telefone, s.email,
            k.inicio::text AS inicio, k.fim::text AS fim, k.planos_alvo, k.slots,
            k.valor_centavos, k.forma_pagamento, k.parcelas, k.dia_vencimento, k.aviso_previo_dias
       FROM sponsor_contracts k
       JOIN sponsors s ON s.id = k.sponsor_id
      WHERE k.id = $1`,
    [contractId],
  );
  const row = head.rows[0];
  if (!row) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
  const arts = await query(
    `SELECT slot, texto_alt, link_destino, enquadramento_zoom::text AS zoom, media_origem
       FROM sponsor_creatives WHERE contract_id = $1 ORDER BY slot`,
    [contractId],
  );
  const doc = String(row.documento || '');
  const formatted = doc.length === 14
    ? `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`
    : doc.length === 11
      ? `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`
      : doc;
  const phone = String(row.telefone || '');
  const phoneLabel = phone.length === 11 ? `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}` : phone;
  const place = `${row.endereco}, ${row.cidade}/${row.uf}`;
  const qualificacao = row.tipo_pessoa === 'pj'
    ? `${row.nome}, razão social ${row.razao_social}, CNPJ ${formatted}, com sede na ${place}, representada por ${row.representante_nome}, ${row.representante_cargo}, telefone ${phoneLabel}, e-mail ${row.email}`
    : `${row.nome}, CPF ${formatted}, residente na ${place}, telefone ${phoneLabel}, e-mail ${row.email}`;
  return {
    qualificacao,
    assinatura: String(row.nome),
    inicio: String(row.inicio),
    fim: String(row.fim),
    planos_alvo: row.planos_alvo as string[],
    slots: row.slots as string[],
    valor_centavos: row.valor_centavos == null ? null : Number(row.valor_centavos),
    forma_pagamento: row.forma_pagamento ? String(row.forma_pagamento) : null,
    parcelas: row.parcelas == null ? null : Number(row.parcelas),
    dia_vencimento: row.dia_vencimento == null ? null : Number(row.dia_vencimento),
    aviso_previo_dias: row.aviso_previo_dias == null ? null : Number(row.aviso_previo_dias),
    criativos: arts.rows.map((item) => `${item.slot}|${item.texto_alt}|${item.zoom}|${item.media_origem}`).join(';'),
  };
}

function snapshotOf(loaded: Loaded) {
  if (
    loaded.valor_centavos == null
    || !loaded.forma_pagamento
    || loaded.parcelas == null
    || loaded.dia_vencimento == null
    || loaded.aviso_previo_dias == null
  ) {
    throw new ApiError(400, 'Complete o contrato antes de gerar o PDF.', 'VALIDATION');
  }
  return buildSnapshot({
    qualificacao: loaded.qualificacao,
    assinatura: loaded.assinatura,
    inicio: loaded.inicio,
    fim: loaded.fim,
    planos: loaded.planos_alvo.map((item) => (item === 'pro' ? 'Pro' : 'Free')).join(' e '),
    espacos: loaded.slots.map((item) => (item === 'tela_cheia' ? 'tela cheia' : 'faixa no Início')).join(' e '),
    valorCentavos: loaded.valor_centavos,
    pagamento: loaded.forma_pagamento,
    parcelas: loaded.parcelas,
    diaVencimento: loaded.dia_vencimento,
    avisoPrevioDias: loaded.aviso_previo_dias,
    criativos: loaded.criativos,
  });
}

export async function currentSnapshot(contractId: string) {
  return snapshotOf(await loadContract(contractId));
}

export async function issueContractDocument(adminId: string, contractId: string) {
  const snapshot = await currentSnapshot(contractId);
  const today = saoPauloToday(new Date());
  return withTransaction(async (sql) => {
    const previous = await sql(
      `SELECT versao, snapshot, gerado_em::text AS gerado_em
         FROM sponsor_contract_documents
        WHERE contract_id = $1
        ORDER BY versao DESC
        LIMIT 1`,
      [contractId],
    );
    const last = previous.rows[0];
    if (last && (last.snapshot as ContractSnapshot).conteudo_sha256 === snapshot.conteudo_sha256) {
      return { versao: Number(last.versao), gerado_em: String(last.gerado_em).slice(0, 10), atual: true };
    }
    const versao = last ? Number(last.versao) + 1 : 1;
    const fresh = await renderContractPdf(fillContract(snapshot, today), versao, today);
    await sql(
      `INSERT INTO sponsor_contract_documents (contract_id, versao, pdf_sha256, snapshot)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [contractId, versao, sha(fresh), JSON.stringify(snapshot)],
    );
    await insertAuditEntry(sql, {
      adminId,
      action: 'SPONSOR_CONTRACT_DOCUMENT',
      targetUserId: null,
      reason: null,
      note: null,
      beforeState: {},
      afterState: { id: contractId, versao },
      keepWhileOrderStands: false,
    });
    return { versao, gerado_em: today, atual: true };
  });
}

export async function contractPdf(contractId: string) {
  const snapshot = await currentSnapshot(contractId);
  const stored = await query(
    `SELECT versao, snapshot, gerado_em::text AS gerado_em, pdf_sha256
       FROM sponsor_contract_documents
      WHERE contract_id = $1
      ORDER BY versao DESC
      LIMIT 1`,
    [contractId],
  );
  const row = stored.rows[0];
  if (!row) throw new ApiError(409, 'Gere o contrato antes de baixar.', 'CONTRACT_REQUIRED');
  const saved = row.snapshot as ContractSnapshot;
  const generated = String(row.gerado_em).slice(0, 10);
  const pdf = await renderContractPdf(fillContract(saved, generated), Number(row.versao), generated);
  return {
    pdf,
    filename: `contrato-patrocinio-v${row.versao}.pdf`,
    atual: saved.conteudo_sha256 === snapshot.conteudo_sha256,
    versao: Number(row.versao),
    gerado_em: generated,
  };
}

export async function documentPreview(contractId: string) {
  const snapshot = await currentSnapshot(contractId);
  const today = saoPauloToday(new Date());
  const stored = await query(
    `SELECT versao, snapshot, gerado_em::text AS gerado_em
       FROM sponsor_contract_documents
      WHERE contract_id = $1
      ORDER BY versao DESC
      LIMIT 1`,
    [contractId],
  );
  const row = stored.rows[0];
  const saved = row ? (row.snapshot as ContractSnapshot) : null;
  const atual = Boolean(saved && saved.conteudo_sha256 === snapshot.conteudo_sha256);
  const gerado = row ? String(row.gerado_em).slice(0, 10) : null;
  return {
    versao: row ? Number(row.versao) : null,
    gerado_em: gerado,
    atual,
    texto: fillContract(atual && saved ? saved : snapshot, gerado || today),
  };
}

export async function assertCurrentDocument(contractId: string) {
  const file = await contractPdf(contractId).catch((error: unknown) => {
    if (error instanceof ApiError) throw error;
    throw error;
  });
  if (!file.atual) {
    throw new ApiError(409, 'Os dados mudaram. Gere a nova versão do contrato.', 'STALE_CONTRACT');
  }
}
