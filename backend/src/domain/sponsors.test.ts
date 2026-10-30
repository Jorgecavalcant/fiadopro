import { describe, expect, it } from 'vitest';
import {
  assertPublicHttps,
  cleanOptionalName,
  consumeRate,
  contractIsLive,
  decideSlot,
  deliversOn,
  eventAllowed,
  metricPlan,
  pickCreative,
  planRenewal,
  pruneOnceKeys,
  saoPauloToday,
  saoPauloTurn,
  SponsorRuleError,
  toPublicCreative,
  transitionContract,
} from './sponsors.js';

const live = {
  status: 'ativo' as const,
  inicio: '2026-10-01',
  fim: '2026-10-31',
  sponsorAtivo: true,
  creativeAtivo: true,
  today: '2026-10-30',
};

describe('patrocínio no ar', () => {
  it('fica no ar no primeiro e no último dia, no fuso de São Paulo', () => {
    expect(contractIsLive(live)).toBe(true);
    expect(contractIsLive({ ...live, today: '2026-10-01' })).toBe(true);
    expect(contractIsLive({ ...live, today: '2026-10-31' })).toBe(true);
    expect(saoPauloToday(new Date('2026-10-30T02:30:00Z'))).toBe('2026-10-29');
    expect(saoPauloTurn(new Date('2026-10-30T09:00:00Z'))).toBe('manha');
    expect(saoPauloTurn(new Date('2026-10-30T15:00:00Z'))).toBe('tarde');
    expect(saoPauloTurn(new Date('2026-10-30T21:00:00Z'))).toBe('noite');
    expect(saoPauloTurn(new Date('2026-10-30T02:30:00Z'))).toBe('noite');
  });

  it('sai do ar fora da data, pausado ou com patrocinador inativo', () => {
    expect(contractIsLive({ ...live, today: '2026-11-01' })).toBe(false);
    expect(contractIsLive({ ...live, status: 'pausado' })).toBe(false);
    expect(contractIsLive({ ...live, sponsorAtivo: false })).toBe(false);
    expect(contractIsLive({ ...live, creativeAtivo: false })).toBe(false);
  });

  it('vence o contrato ativo e não religa o vencido', () => {
    expect(transitionContract('ativo', 'vencer', '2026-10-29', '2026-10-30')).toBe('vencido');
    expect(transitionContract('ativo', 'vencer', '2026-10-30', '2026-10-30')).toBe('ativo');
    expect(() => transitionContract('vencido', 'ativar', '2026-10-30', '2026-10-30')).toThrow(
      SponsorRuleError,
    );
    expect(transitionContract('pausado', 'retomar', '2026-10-29', '2026-10-30')).toBe('vencido');
  });

  it('renova só o vencido, com contrato novo', () => {
    expect(planRenewal('vencido', '2026-11-01', '2026-11-30', '2026-10-30')).toBe('rascunho');
    expect(planRenewal('vencido', '2026-10-30', '2026-11-30', '2026-10-30')).toBe('ativo');
    expect(() => planRenewal('ativo', '2026-11-01', '2026-11-30', '2026-10-30')).toThrow(
      SponsorRuleError,
    );
  });
});

describe('quem vê o anúncio', () => {
  it('separa Free, Pro, Enterprise e admin', () => {
    expect(decideSlot('FREE', true, 'faixa')).toBe('faixa');
    expect(decideSlot('FREE', true, 'tela_cheia')).toBe('tela_cheia');
    expect(decideSlot('PRO', true, 'faixa')).toBe('faixa');
    expect(decideSlot('PRO', true, 'tela_cheia')).toBeNull();
    expect(decideSlot('ENTERPRISE', true, 'faixa')).toBeNull();
    expect(decideSlot('ADMIN', true, 'tela_cheia')).toBeNull();
  });

  it('sem plano confirmado mostra no máximo a faixa e não grava o total', () => {
    expect(decideSlot('FREE', false, 'faixa')).toBe('faixa');
    expect(decideSlot('ENTERPRISE', false, 'tela_cheia')).toBeNull();
    expect(metricPlan('FREE', false)).toBeNull();
    expect(metricPlan('PRO', true)).toBe('pro');
    expect(metricPlan('ENTERPRISE', true)).toBeNull();
  });

  it('a tela cheia conta só se já foi entregue naquele turno', () => {
    expect(
      eventAllowed({
        live: true,
        slot: 'tela_cheia',
        plan: 'FREE',
        confirmed: true,
        fullscreenDelivered: false,
      }),
    ).toBe(false);
    expect(
      eventAllowed({
        live: true,
        slot: 'tela_cheia',
        plan: 'FREE',
        confirmed: true,
        fullscreenDelivered: true,
      }),
    ).toBe(true);
    expect(
      eventAllowed({
        live: true,
        slot: 'tela_cheia',
        plan: 'PRO',
        confirmed: true,
        fullscreenDelivered: true,
      }),
    ).toBe(false);
  });

  it('roda o criativo com menos exibições', () => {
    const chosen = pickCreative([
      { id: 'b', ordem: 0, exibicoesHoje: 3 },
      { id: 'a', ordem: 2, exibicoesHoje: 1 },
      { id: 'c', ordem: 1, exibicoesHoje: 1 },
    ]);
    expect(chosen?.id).toBe('c');
  });

  it('limita a rajada de eventos', () => {
    const store = new Map<string, { n: number; reset: number }>();
    expect(consumeRate(store, 'u', 0, 2, 1000)).toBe(true);
    expect(consumeRate(store, 'u', 10, 2, 1000)).toBe(true);
    expect(consumeRate(store, 'u', 20, 2, 1000)).toBe(false);
  });
});

describe('endereço e texto público', () => {
  it('aceita só https público', () => {
    expect(assertPublicHttps('https://exemplo.com/anuncio')).toContain('https://exemplo.com/');
    for (const bad of [
      'http://exemplo.com',
      'javascript:alert(1)',
      'data:text/html,oi',
      'https://localhost/a',
      'https://127.0.0.1/a',
      'https://10.0.0.8/a',
      'https://192.168.0.1/a',
      'https://user:senha@exemplo.com/a',
    ]) {
      expect(() => assertPublicHttps(bad)).toThrow(SponsorRuleError);
    }
  });

  it('não guarda e-mail nem telefone no contato e não vaza campo interno', () => {
    expect(() => cleanOptionalName('ana@exemplo.com')).toThrow(SponsorRuleError);
    expect(() => cleanOptionalName('(11) 98888-7777')).toThrow(SponsorRuleError);
    expect(assertPublicHttps('https://fcbarcelona.com/a')).toContain('fcbarcelona.com');
    expect(assertPublicHttps('https://fdcomunicacao.com.br/a')).toContain('fdcomunicacao.com.br');
    expect(assertPublicHttps('https://wa.me/5500000000000')).toContain('wa.me');
    expect(assertPublicHttps('https://100.128.0.1/a')).toContain('100.128.0.1');
    expect(assertPublicHttps('https://[fec0::1]/a')).toContain('fec0::1');
    expect(assertPublicHttps('https://[64:ff99::1]/a')).toContain('64:ff99::1');
    for (const bad of [
      'https://[::ffff:127.0.0.1]/a',
      'https://[::ffff:7f00:1]/a',
      'https://[::]/a',
      'https://100.64.0.1/a',
      'https://[fc00::1]/a',
      'https://[fe80::1]/a',
      'https://[fe90::1]/a',
      'https://[fea0::1]/a',
      'https://[febf::1]/a',
      'https://[64:ff9b::1]/a',
      'https://[64:ff9b::8.8.8.8]/a',
    ]) {
      expect(() => assertPublicHttps(bad)).toThrow(SponsorRuleError);
    }
    const keys = new Set(['u|c|exibicao|2026-10-29', 'u|c|clique|2026-10-30']);
    pruneOnceKeys(keys, '2026-10-30');
    expect([...keys]).toEqual(['u|c|clique|2026-10-30']);
    const pub = toPublicCreative({
      id: 'c1',
      tipo: 'imagem',
      media_url: 'https://exemplo.com/a.png',
      link_destino: 'https://exemplo.com',
      titulo: 'TESTE',
      texto_alt: 'Anúncio TESTE',
      patrocinador: 'TESTE Mercado',
      valor_centavos: 1000,
      observacao: 'interno',
      contato_nome: 'Alguém',
    });
    expect(pub).not.toHaveProperty('valor_centavos');
    expect(pub).not.toHaveProperty('observacao');
    expect(JSON.stringify(pub)).not.toContain('@');
    expect(deliversOn('ativo', '2026-11-01', '2026-12-31', '2026-10-30')).toBe(false);
    expect(deliversOn('ativo', '2026-11-01', '2026-12-31', '2026-11-01')).toBe(true);
    expect(deliversOn('rascunho', '2026-10-01', '2026-12-31', '2026-11-01')).toBe(false);
  });
});
