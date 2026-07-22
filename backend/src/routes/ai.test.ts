import { describe, it, expect } from 'vitest';
import { ReadDocumentSchema, AnalyzeCustomerSchema, estimateBase64Bytes, MAX_IMAGE_BYTES } from './ai.js';

describe('estimateBase64Bytes', () => {
  it('estima o tamanho real de um base64 sem padding', () => {
    // "Man" (3 bytes) codifica em base64 como "TWFu" (4 chars, sem padding)
    expect(estimateBase64Bytes('TWFu')).toBe(3);
  });

  it('ignora o prefixo data URI se vier junto por engano', () => {
    const withPrefix = 'data:image/png;base64,TWFu';
    // O prefixo não é base64 válido, mas a função só precisa de uma estimativa
    // conservadora — o importante é nunca subestimar o tamanho real do arquivo.
    expect(estimateBase64Bytes(withPrefix)).toBeGreaterThanOrEqual(estimateBase64Bytes('TWFu'));
  });
});

describe('ReadDocumentSchema — validação de mime e tamanho', () => {
  const validPayload = {
    image: { data: 'TWFu', mimeType: 'image/jpeg' as const },
  };

  it('aceita mime types permitidos (jpeg/png/webp/pdf)', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const) {
      const result = ReadDocumentSchema.safeParse({ image: { data: 'TWFu', mimeType } });
      expect(result.success).toBe(true);
    }
  });

  it('rejeita mime type fora do allowlist', () => {
    const result = ReadDocumentSchema.safeParse({
      image: { data: 'TWFu', mimeType: 'application/zip' },
    });
    expect(result.success).toBe(false);
  });

  it('rejeita imagem maior que 15MB', () => {
    // Gera um base64 cujo tamanho decodificado estoura MAX_IMAGE_BYTES.
    const oversizedBase64 = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1024) / 3) * 4);
    const result = ReadDocumentSchema.safeParse({
      image: { data: oversizedBase64, mimeType: 'image/png' },
    });
    expect(result.success).toBe(false);
  });

  it('aceita payload válido com hint opcional', () => {
    const result = ReadDocumentSchema.safeParse({ ...validPayload, hint: 'recibo de mercado' });
    expect(result.success).toBe(true);
  });

  it('rejeita quando falta image.data', () => {
    const result = ReadDocumentSchema.safeParse({ image: { mimeType: 'image/jpeg' } });
    expect(result.success).toBe(false);
  });
});

describe('AnalyzeCustomerSchema', () => {
  it('aceita modo customer com transações', () => {
    const result = AnalyzeCustomerSchema.safeParse({
      customer: { name: 'Maria', balance: 150.5 },
      transactions: [{ type: 'DEBT', amount: 100, description: 'Fiado', timestamp: 123 }],
      language: 'pt-BR',
    });
    expect(result.success).toBe(true);
  });

  it('aplica defaults quando campos opcionais faltam', () => {
    const result = AnalyzeCustomerSchema.parse({});
    expect(result.transactions).toEqual([]);
    expect(result.language).toBe('pt-BR');
    expect(result.mode).toBe('customer');
  });

  it('aceita modo business com stats', () => {
    const result = AnalyzeCustomerSchema.safeParse({
      mode: 'business',
      stats: { totalReceivable: 500, activeCustomers: 10 },
    });
    expect(result.success).toBe(true);
  });
});
