import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));
vi.mock('../services/linking.js', () => ({
  linkCustomer: vi.fn(),
  relinkCustomersForUser: vi.fn(),
  ensureAdminRole: vi.fn(),
}));

import { TransactionSchema } from './transactions.js';
import { CustomerSchema } from './customers.js';

describe('TransactionSchema', () => {
  const base = {
    customer_id: '4fa8ad12-9c1b-4c11-b6a1-0e1b2c3d4e5f',
    type: 'DEBT' as const,
    amount: 50,
    description: 'fiado do pão',
  };

  it('aceita lançamento válido', () => {
    expect(TransactionSchema.parse(base).amount).toBe(50);
  });

  it('rejeita valor zero ou negativo', () => {
    expect(() => TransactionSchema.parse({ ...base, amount: 0 })).toThrow();
    expect(() => TransactionSchema.parse({ ...base, amount: -10 })).toThrow();
  });

  it('rejeita tipo de lançamento desconhecido', () => {
    expect(() => TransactionSchema.parse({ ...base, type: 'PIX_FANTASMA' })).toThrow();
  });

  it('rejeita anexo com mime não permitido', () => {
    expect(() =>
      TransactionSchema.parse({
        ...base,
        attachment: { data: 'aGk=', mimeType: 'application/x-msdownload', name: 'virus.exe' },
      }),
    ).toThrow();
  });

  it('aceita anexo de imagem permitido', () => {
    const parsed = TransactionSchema.parse({
      ...base,
      attachment: { data: 'aGk=', mimeType: 'image/jpeg', name: 'comprovante.jpg' },
    });
    expect(parsed.attachment?.mimeType).toBe('image/jpeg');
  });

  it('rejeita customer_id que não é uuid', () => {
    expect(() =>
      TransactionSchema.parse({ ...base, customer_id: '1; DROP TABLE users' }),
    ).toThrow();
  });
});

describe('CustomerSchema', () => {
  it('aceita cliente mínimo (nome + telefone)', () => {
    const parsed = CustomerSchema.parse({ name: 'Dyllan', phone: '(62) 99999-1234' });
    expect(parsed.name).toBe('Dyllan');
  });

  it('rejeita e-mail inválido', () => {
    expect(() => CustomerSchema.parse({ name: 'X', phone: '1', email: 'não-é-email' })).toThrow();
  });

  it('rejeita estratégia de sobra desconhecida', () => {
    expect(() =>
      CustomerSchema.parse({ name: 'X', phone: '1', overpayment_strategy: 'ROUBAR' }),
    ).toThrow();
  });
});
