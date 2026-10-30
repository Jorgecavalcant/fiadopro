import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it } from 'vitest';
import { buildSnapshot, fillContract, renderContractPdf } from './sponsorContractDoc.js';
import { artAuditState, MEDIA_SQL } from './sponsorMedia.js';
import { BOARD_SQL, REPORT_HEAD_SQL } from './sponsorReads.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

describe('contrato e mídia', () => {
  let db: PGlite;

  afterAll(async () => {
    await db?.close();
  });

  it('a migration 017 sobe, volta e não mexe no que já existia', async () => {
    const up = readFileSync(join(root, '017_sponsor_contract_flow.sql'), 'utf8');
    const down = readFileSync(join(root, 'down/017_sponsor_contract_flow.sql'), 'utf8');
    expect(up).not.toMatch(/DROP TABLE/i);
    expect(down).toContain('DROP TABLE IF EXISTS sponsor_media');
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id uuid PRIMARY KEY); CREATE TABLE legado_ok (id int PRIMARY KEY); INSERT INTO legado_ok (id) VALUES (1);`);
    await db.exec(readFileSync(join(root, '016_sponsors.sql'), 'utf8'));
    await db.exec(up);
    await db.exec(up);
    await db.exec(`INSERT INTO sponsors (nome, categoria, cidade, documento) VALUES ('TESTE Mercado', 'Mercado', 'Teste', '39053344705')`);
    await db.exec(down);
    const columns = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'documento'`);
    expect(columns.rows).toEqual([]);
    const legado = await db.query(`SELECT id FROM legado_ok`);
    expect(legado.rows).toEqual([{ id: 1 }]);
  });

  it('lista, relatório e mídia pública não carregam dado pessoal', () => {
    const delivery = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sponsorDelivery.ts'), 'utf8');
    const report = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sponsorReportPdf.ts'), 'utf8');
    const joined = `${BOARD_SQL}\n${REPORT_HEAD_SQL}\n${MEDIA_SQL}\n${delivery}\n${report}`;
    expect(joined).not.toMatch(/\btelefone\b|\bemail\b|contato_nome/);
    expect(BOARD_SQL).toContain('documento_mascarado');
    expect(BOARD_SQL).not.toContain('s.telefone');
  });

  it('o PDF do contrato traz a marca, a versão e os dados da Tech 42', async () => {
    const snapshot = buildSnapshot({
      qualificacao: 'TESTE Padaria Bom Pão, CNPJ 11.222.333/0001-81, telefone 62900000000, e-mail teste@exemplo.test',
      assinatura: 'TESTE Padaria Bom Pão',
      inicio: '2026-11-01',
      fim: '2026-12-31',
      planos: 'Free e Pro',
      espacos: 'faixa no Início',
      valorCentavos: 60000,
      pagamento: 'pix',
      parcelas: 2,
      diaVencimento: 5,
      avisoPrevioDias: 15,
      criativos: 'faixa',
    });
    const text = fillContract(snapshot, '2026-10-30');
    expect(text).toContain('CONTRATO DE PATROCÍNIO E VEICULAÇÃO DE PUBLICIDADE');
    expect(text).toContain('66.499.920/0001-04');
    expect(text).toContain('Avenida Comercial, 814, Quadra 61, Lote 10, Sala 1, Bairro da Vitória, Goiânia/GO, CEP 74477-012');
    expect(text).toContain('produto criado e gerido pela TECH 42 LTDA');
    const pdf = await renderContractPdf(text, 1, '2026-10-30');
    const raw = pdf.toString('latin1');
    const decoded = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => {
      let plain = match[1];
      try { plain = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { /* fluxo já legível */ }
      const literals = [...plain.matchAll(/\((?:\\.|[^)\\])*\)/g)].map((item) => item[0].slice(1, -1));
      const hexes = [...plain.matchAll(/<([0-9A-Fa-f]+)>/g)].map((item) => {
        let word = '';
        for (let i = 0; i + 1 < item[1].length; i += 2) word += String.fromCharCode(Number.parseInt(item[1].slice(i, i + 2), 16));
        return word;
      });
      return literals.concat(hexes).join('');
    }).join('');
    expect(decoded).toContain('Fiado Pro');
    expect(decoded).toContain('TESTE Padaria');
    expect(decoded).toContain('66.499.920/0001-04');
    expect(decoded).toContain('Avenida Comercial, 814');
    expect(decoded).toContain('versão');
  });

  it('a auditoria da arte só leva o id da mídia e do criativo', () => {
    expect(artAuditState('mid', 'cid')).toEqual({
      media_id: 'mid',
      creative_id: 'cid',
      resumo: 'arte enviada',
    });
    const source = readFileSync(new URL('./sponsorMedia.ts', import.meta.url), 'utf8');
    const audit = source.slice(source.indexOf('await insertAuditEntry'));
    expect(audit).toContain('artAuditState(mediaId, creativeId)');
    expect(audit).not.toContain('texto_alt');
    expect(audit).not.toContain('filename');
    expect(audit).not.toMatch(/\btelefone\b|\bemail\b/);
  });

  it('depois da renovação a mídia pública prefere o contrato ativo', async () => {
    const local = new PGlite();
    try {
      await local.exec(`CREATE TABLE users (id uuid PRIMARY KEY);`);
      await local.exec(readFileSync(join(root, '016_sponsors.sql'), 'utf8'));
      await local.exec(readFileSync(join(root, '017_sponsor_contract_flow.sql'), 'utf8'));
      const sponsor = await local.query<{ id: string }>(
        `INSERT INTO sponsors (nome, categoria, cidade) VALUES ('TESTE Padaria', 'Padaria', 'Teste') RETURNING id`,
      );
      const sponsorId = sponsor.rows[0].id;
      const media = await local.query<{ id: string }>(
        `INSERT INTO sponsor_media (conteudo, content_type, byte_size, largura, altura, sha256)
         VALUES ($1, 'image/png', 4, 8, 8, $2) RETURNING id`,
        [Buffer.from([1, 2, 3, 4]), 'a'.repeat(64)],
      );
      const mediaId = media.rows[0].id;
      const oldContract = await local.query<{ id: string }>(
        `INSERT INTO sponsor_contracts (sponsor_id, inicio, fim, planos_alvo, slots, status)
         VALUES ($1, '2020-01-01', '2020-06-01', ARRAY['free'], ARRAY['faixa'], 'vencido') RETURNING id`,
        [sponsorId],
      );
      const live = await local.query<{ id: string }>(
        `INSERT INTO sponsor_contracts (sponsor_id, inicio, fim, planos_alvo, slots, status, renovado_de)
         VALUES ($1, '2026-01-01', '2099-01-01', ARRAY['free'], ARRAY['faixa'], 'ativo', $2) RETURNING id`,
        [sponsorId, oldContract.rows[0].id],
      );
      const creative = `INSERT INTO sponsor_creatives
        (contract_id, tipo, slot, media_url, media_origem, media_id, link_destino, titulo, texto_alt)
        VALUES ($1, 'imagem', 'faixa', $2, 'upload', $3, 'https://exemplo.test/teste', 'Pao', 'Pao')`;
      await local.query(creative, [oldContract.rows[0].id, `/api/sponsors/media/${mediaId}`, mediaId]);
      await local.query(creative, [live.rows[0].id, `/api/sponsors/media/${mediaId}`, mediaId]);
      const picked = await local.query<{ status: string }>(MEDIA_SQL, [mediaId]);
      expect(picked.rows).toHaveLength(1);
      expect(picked.rows[0].status).toBe('ativo');

      const expiredOnly = await local.query<{ id: string }>(
        `INSERT INTO sponsor_media (conteudo, content_type, byte_size, largura, altura, sha256)
         VALUES ($1, 'image/png', 4, 8, 8, $2) RETURNING id`,
        [Buffer.from([5, 6, 7, 8]), 'b'.repeat(64)],
      );
      await local.query(creative, [oldContract.rows[0].id, `/api/sponsors/media/${expiredOnly.rows[0].id}`, expiredOnly.rows[0].id]);
      const leftover = await local.query<{ status: string }>(MEDIA_SQL, [expiredOnly.rows[0].id]);
      expect(leftover.rows[0].status).toBe('vencido');
    } finally {
      await local.close();
    }
  });
});
