import { describe, expect, it } from 'vitest';
import { brDateInputToTimestamp, formatBrDate, formatBrDateTime } from './formatBr';

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
});
