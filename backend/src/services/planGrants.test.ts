import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

import { parseFutureExpiry, validateGrantNote } from './planGrants.js';

describe('observação da concessão', () => {
  it('aceita um motivo longo sem documento e sem e-mail', () => {
    expect(validateGrantNote('Cortesia combinada com o lojista')).toBeNull();
  });

  it('recusa texto curto', () => {
    expect(validateGrantNote('curta')).toMatch(/8 caracteres/);
  });

  it('recusa CPF formatado', () => {
    expect(validateGrantNote('motivo 000.000.000-00 aqui')).toMatch(/CPF/);
  });

  it('recusa CNPJ formatado', () => {
    expect(validateGrantNote('loja 00.000.000/0001-00 agora')).toMatch(/CNPJ/);
  });

  it('recusa texto com e-mail', () => {
    expect(validateGrantNote('falar com a@example.test hoje')).toMatch(/e-mail/);
  });
});

describe('prazo da concessão', () => {
  it('aceita data futura e devolve o instante', () => {
    const parsed = parseFutureExpiry(new Date(Date.now() + 86_400_000).toISOString(), true);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('cortesia sem prazo fica em aberto', () => {
    expect(parseFutureExpiry(null, false)).toEqual({ ok: true, expiresAt: null });
    expect(parseFutureExpiry('   ', false)).toEqual({ ok: true, expiresAt: null });
  });

  it('recusa prazo ausente quando ele é obrigatório', () => {
    const parsed = parseFutureExpiry(null, true);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toMatch(/prazo futuro/);
  });

  it('recusa prazo no passado ou inválido', () => {
    const past = parseFutureExpiry(new Date(Date.now() - 86_400_000).toISOString(), false);
    expect(past.ok).toBe(false);
    const invalid = parseFutureExpiry('amanha', true);
    expect(invalid.ok).toBe(false);
  });
});
