import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BOARD_SQL,
  DAILY_SQL,
  SUMMARY_EVENTS_SQL,
  fillDays,
  ratio,
} from './sponsorReads.js';
import { renderSponsorPdf } from './sponsorReportPdf.js';

describe('leituras de marketing', () => {
  it('completa os dias vazios e não lê dado de pessoa', () => {
    const days = fillDays('2026-10-01', '2026-10-03', [
      { dia: '2026-10-02', exibicoes: 4, cliques: 1 },
    ]);
    expect(days).toEqual([
      { dia: '2026-10-01', exibicoes: 0, cliques: 0 },
      { dia: '2026-10-02', exibicoes: 4, cliques: 1 },
      { dia: '2026-10-03', exibicoes: 0, cliques: 0 },
    ]);
    expect(ratio(1, 4)).toBe(0.25);
    const sql = `${BOARD_SQL}\n${DAILY_SQL}\n${SUMMARY_EVENTS_SQL}`;
    expect(sql).not.toMatch(/user_id|contato_nome|valor_centavos|observacao/i);
  });

  it('o PDF traz a marca e só contagens', async () => {
    const pdf = await renderSponsorPdf({
      nome: 'TESTE Padaria',
      inicio: '2026-10-01',
      fim: '2026-10-31',
      from: '2026-10-17',
      to: '2026-10-18',
      rows: [{ slot: 'faixa', plano: 'free', exibicoes: 10, cliques: 2, ctr: 0.2 }],
      days: [
        { dia: '2026-10-17', exibicoes: 4, cliques: 1 },
        { dia: '2026-10-18', exibicoes: 6, cliques: 1 },
      ],
    });
    const raw = pdf.toString('latin1');
    const text = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => {
      let plain = match[1];
      try { plain = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { /* fluxo sem compressão */ }
      return [...plain.matchAll(/<([0-9A-Fa-f]+)>/g)].map((item) => {
        let word = '';
        for (let i = 0; i + 1 < item[1].length; i += 2) word += String.fromCharCode(Number.parseInt(item[1].slice(i, i + 2), 16));
        return word;
      }).join('');
    }).join('');
    expect(text).toContain('Fiado Pro');
    expect(text).toContain('contagens');
    expect(text).toContain('TESTE Padaria');
    expect(text).not.toMatch(/@|user_id|contato_nome|cpf|pix/i);
  });
});
