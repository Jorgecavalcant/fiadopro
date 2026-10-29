import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  query: vi.fn(),
}));

import { ImportTransactionSchema } from './sync.js';

describe('importação offline', () => {
  it('valor zero ou negativo usa a frase em português', () => {
    const base = {
      id: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      type: 'PAYMENT' as const,
      description: 'pago',
      timestamp: 1,
    };
    for (const amount of [0, -5]) {
      const parsed = ImportTransactionSchema.safeParse({ ...base, amount });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe('Informe um valor maior que zero');
      }
    }
  });
});
