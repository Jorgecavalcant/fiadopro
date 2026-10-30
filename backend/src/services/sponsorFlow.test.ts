import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it } from 'vitest';
import { buildSnapshot, fillContract, renderContractPdf } from './sponsorContractDoc.js';
import { MEDIA_SQL } from './sponsorMedia.js';
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

  it('o PDF do contrato traz a marca, a versão e o marcador da Tech 42', async () => {
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
    expect(text).toContain('[CNPJ da Tech 42]');
    expect(text).toContain('[Endereço da Tech 42]');
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
    expect(decoded).toContain('[CNPJ da Tech 42]');
    expect(decoded).toContain('versão');
  });
});
