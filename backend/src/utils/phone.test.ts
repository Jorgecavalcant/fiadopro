import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  isValidNormalizedPhone,
  validatePhoneInput,
  phonesMatchMobile9th,
  phoneMatchVariants,
  PHONE_INVALID_MESSAGE,
} from './phone.js';

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
    expect(normalizePhone('062999991234')).toBe('62999991234');
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

describe('isValidNormalizedPhone / validatePhoneInput', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(isValidNormalizedPhone('6299991234')).toBe(true);
    expect(isValidNormalizedPhone('62999991234')).toBe(true);
    expect(validatePhoneInput('(62) 99999-1234')).toBe('62999991234');
    expect(validatePhoneInput('62 9999-1234')).toBe('6299991234');
  });

  it('rejeita tamanhos inválidos com mensagem em PT-BR', () => {
    expect(isValidNormalizedPhone('629999123')).toBe(false);
    expect(isValidNormalizedPhone('629999912345')).toBe(false);
    expect(() => validatePhoneInput('123')).toThrow(PHONE_INVALID_MESSAGE);
    expect(validatePhoneInput('')).toBe('');
    expect(validatePhoneInput(null)).toBe('');
  });
});

describe('phonesMatchMobile9th', () => {
  it('casa 11 (DDD+9+8) com 10 (DDD+8) iguais', () => {
    expect(phonesMatchMobile9th('62999991234', '6299991234')).toBe(true);
    expect(phonesMatchMobile9th('6299991234', '62999991234')).toBe(true);
  });

  it('igualdade exata', () => {
    expect(phonesMatchMobile9th('62999991234', '62999991234')).toBe(true);
  });

  it('não iguala dois 11 diferentes nem dois 10 diferentes', () => {
    expect(phonesMatchMobile9th('62999991234', '62988881234')).toBe(false);
    expect(phonesMatchMobile9th('6299991234', '6288881234')).toBe(false);
  });

  it('exige 9 na terceira posição do número de 11', () => {
    expect(phonesMatchMobile9th('62899991234', '6289991234')).toBe(false);
  });

  it('documenta edge fixo↔móvel da regra DDD+9+8 ↔ DDD+8', () => {
    // Um fixo 10 dígitos com os mesmos 8 finais casaria com móvel DDD+9+8 —
    // comportamento intencional da regra móvel documentada no PR.
    expect(phonesMatchMobile9th('6233334444', '62933334444')).toBe(true);
  });
});

describe('phoneMatchVariants', () => {
  it('inclui forma com e sem 9º dígito', () => {
    expect(phoneMatchVariants('62999991234').sort()).toEqual(['6299991234', '62999991234']);
    expect(phoneMatchVariants('6299991234').sort()).toEqual(['6299991234', '62999991234']);
    expect(phoneMatchVariants('')).toEqual([]);
  });
});
