import { describe, expect, it } from 'vitest';
import {
  amountFieldMessage,
  brDateInputToTimestamp,
  brDisplayToIso,
  descriptionFieldMessage,
  formatBrCurrencyInput,
  formatBrDate,
  formatBrDateTime,
  maskBrDateTyping,
  parseBrCurrencyInput,
  timestampToIsoDate,
} from './formatBr';

describe('formatBrDate', () => {
  it('mostra o dia anterior em São Paulo quando o instante UTC ainda é madrugada', () => {
    // 15/03/2026 02:30 UTC = 14/03/2026 23:30 em São Paulo (UTC−3, sem horário de verão).
    const utcDawn = '2026-03-15T02:30:00.000Z';
    expect(formatBrDate(utcDawn)).toBe('14/03/2026');
    expect(formatBrDate(new Date(utcDawn))).toBe('14/03/2026');
    expect(formatBrDate(Date.parse(utcDawn))).toBe('14/03/2026');
  });

  it('mantém o dia seguinte depois da meia-noite em São Paulo', () => {
    // 15/03/2026 03:00 UTC = 15/03/2026 00:00 em São Paulo.
    const utcMidnightSp = '2026-03-15T03:00:00.000Z';
    expect(formatBrDate(utcMidnightSp)).toBe('15/03/2026');
    expect(formatBrDateTime(utcMidnightSp)).toBe('15/03/2026 00:00');
  });

  it('formata a data escolhida no seletor sem trocar o dia', () => {
    expect(formatBrDate('2026-10-29')).toBe('29/10/2026');
  });
});

describe('formatBrDateTime', () => {
  it('usa hora de 24h no fuso de São Paulo', () => {
    expect(formatBrDateTime('2026-03-15T02:30:00.000Z')).toBe('14/03/2026 23:30');
    expect(formatBrDateTime('2026-03-15T18:00:00.000Z')).toBe('15/03/2026 15:00');
  });
});

describe('brDateInputToTimestamp', () => {
  it('grava um timestamp cujo dia em São Paulo é o dia escolhido', () => {
    const stored = brDateInputToTimestamp('2026-10-29');
    expect(typeof stored).toBe('number');
    expect(formatBrDate(stored as number)).toBe('29/10/2026');
  });

  it('não inventa vencimento quando o campo fica em branco', () => {
    expect(brDateInputToTimestamp('')).toBeUndefined();
    expect(brDateInputToTimestamp('29/10/2026')).toBeUndefined();
  });

  it('mostra dd/mm/aaaa e devolve o mesmo dia em YYYY-MM-DD', () => {
    expect(maskBrDateTyping('29102026')).toBe('29/10/2026');
    expect(brDisplayToIso('29/10/2026')).toBe('2026-10-29');
    const stored = brDateInputToTimestamp('2026-10-29');
    expect(timestampToIsoDate(stored as number)).toBe('2026-10-29');
    expect(formatBrDate(stored as number)).toBe('29/10/2026');
  });

  it('não aceita uma data impossível', () => {
    expect(brDisplayToIso('31/02/2026')).toBeUndefined();
  });
});

describe('moeda brasileira', () => {
  it('digitar 1000000 mostra R$ 10.000,00 e o número 10000', () => {
    expect(parseBrCurrencyInput('1000000')).toBe(10000);
    expect(formatBrCurrencyInput(10000)).toBe('R$ 10.000,00');
  });

  it('colar 1.234,56 ou 1234,56 vira o número 1234.56', () => {
    const pasted = parseBrCurrencyInput('1.234,56');
    const plain = parseBrCurrencyInput('1234,56');
    expect(typeof pasted).toBe('number');
    expect(Math.round((pasted ?? 0) * 100)).toBe(123456);
    expect(Math.round((plain ?? 0) * 100)).toBe(123456);
    expect(String(pasted)).not.toMatch(/R\$/);
  });

  it('trata centavos 0,01 e 999.999,99', () => {
    expect(Math.round((parseBrCurrencyInput('1') ?? 0) * 100)).toBe(1);
    expect(formatBrCurrencyInput(0.01)).toBe('R$ 0,01');
    expect(Math.round((parseBrCurrencyInput('999.999,99') ?? 0) * 100)).toBe(99999999);
    expect(formatBrCurrencyInput(999999.99)).toBe('R$ 999.999,99');
  });

  it('valor 0 ou vazio pede um valor maior que zero, e descrição vazia pede texto', () => {
    expect(amountFieldMessage(null)).toBe('Informe um valor maior que zero');
    expect(amountFieldMessage(0)).toBe('Informe um valor maior que zero');
    expect(amountFieldMessage(0.01)).toBe('');
    expect(descriptionFieldMessage('   ')).toBe('Informe uma descrição');
    expect(descriptionFieldMessage('Fiado')).toBe('');
  });
});
