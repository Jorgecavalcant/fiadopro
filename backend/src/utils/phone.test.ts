import { describe, it, expect } from 'vitest';
import { assertValidBrPhoneOrEmpty, isValidBrPhone, normalizePhone } from './phone.js';

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

describe('isValidBrPhone', () => {
  it('aceita 10 ou 11 dígitos após normalizar', () => {
    expect(isValidBrPhone('(62) 99999-1234')).toBe(true);
    expect(isValidBrPhone('6233334444')).toBe(true);
    expect(isValidBrPhone('+55 62 99999-1234')).toBe(true);
  });

  it('rejeita vazio ou tamanho inválido', () => {
    expect(isValidBrPhone('')).toBe(false);
    expect(isValidBrPhone('123')).toBe(false);
    expect(isValidBrPhone('629999912345')).toBe(false);
  });
});

describe('assertValidBrPhoneOrEmpty', () => {
  it('aceita vazio', () => {
    expect(assertValidBrPhoneOrEmpty('')).toEqual({ ok: true, normalized: '' });
    expect(assertValidBrPhoneOrEmpty(null)).toEqual({ ok: true, normalized: '' });
    expect(assertValidBrPhoneOrEmpty('   ')).toEqual({ ok: true, normalized: '' });
  });

  it('aceita telefone BR válido', () => {
    expect(assertValidBrPhoneOrEmpty('(62) 99999-1234')).toEqual({
      ok: true,
      normalized: '62999991234',
    });
  });

  it('rejeita telefone inválido sem lançar', () => {
    const result = assertValidBrPhoneOrEmpty('123');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/telefone brasileiro/i);
    }
  });
});
