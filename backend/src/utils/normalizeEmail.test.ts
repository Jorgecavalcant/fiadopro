import { describe, it, expect } from 'vitest';
import { normalizeEmail } from './normalizeEmail.js';

describe('normalizeEmail', () => {
  it('converte o e-mail para minusculas', () => {
    expect(normalizeEmail('Jorge@Gmail.com')).toBe('jorge@gmail.com');
  });

  it('remove espacos nas pontas', () => {
    expect(normalizeEmail('  jorge@gmail.com  ')).toBe('jorge@gmail.com');
  });

  it('trata espacos e maiusculas juntos', () => {
    expect(normalizeEmail('  JORGE@Gmail.COM ')).toBe('jorge@gmail.com');
  });

  it('nao altera um e-mail ja normalizado', () => {
    expect(normalizeEmail('jorge@gmail.com')).toBe('jorge@gmail.com');
  });
});
