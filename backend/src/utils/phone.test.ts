import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('remove máscara e não-dígitos', () => {
    expect(normalizePhone('(62) 99999-1234')).toBe('62999991234');
  });

  it('remove DDI 55 quando presente com 12+ dígitos', () => {
    expect(normalizePhone('+55 62 99999-1234')).toBe('62999991234');
    expect(normalizePhone('5562999991234')).toBe('62999991234');
  });

  it('NÃO remove 55 de um DDD 55 legítimo (11 dígitos)', () => {
    expect(normalizePhone('55 99999-1234')).toBe('55999991234');
  });

  it('remove zero de tronco', () => {
    expect(normalizePhone('062 99999-1234')).toBe('62999991234');
  });

  it('normaliza formas diferentes do MESMO número para o mesmo valor (caso Jorge↔Dyllan)', () => {
    const a = normalizePhone('+55 (62) 99999-1234');
    const b = normalizePhone('62 999991234');
    const c = normalizePhone('062999991234');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('entradas vazias/nulas viram string vazia', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('abc')).toBe('');
  });
});
