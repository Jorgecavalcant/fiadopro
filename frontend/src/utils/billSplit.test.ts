import { describe, it, expect } from 'vitest';
import {
  computeItemPrice,
  getItemQuantity,
  getItemUnitPrice,
  planEventSplitRecords,
  formatDateBR,
} from './billSplit';

describe('computeItemPrice', () => {
  it('calcula price = quantity * unitPrice', () => {
    expect(computeItemPrice({ quantity: 3, unitPrice: 10.5, price: 0 })).toBe(31.5);
  });

  it('arredonda a 2 casas decimais', () => {
    expect(computeItemPrice({ quantity: 3, unitPrice: 0.1, price: 0 })).toBe(0.3);
  });

  it('usa fallback quantity=1 quando o item legado não tem quantity', () => {
    expect(getItemQuantity({ quantity: undefined })).toBe(1);
    expect(computeItemPrice({ quantity: undefined, unitPrice: 25, price: 0 })).toBe(25);
  });

  it('usa fallback unitPrice=price quando o item legado não tem unitPrice', () => {
    expect(getItemUnitPrice({ unitPrice: undefined, price: 42 })).toBe(42);
    // Item legado (só price, sem quantity/unitPrice) recalcula para o mesmo price — não quebra dados existentes.
    expect(computeItemPrice({ quantity: undefined, unitPrice: undefined, price: 42 })).toBe(42);
  });
});

describe('planEventSplitRecords', () => {
  const eventId = 'ev1';

  it('cria registros novos quando nenhum participante tem registro prévio para o evento', () => {
    const shares = [
      { participantId: 'p1', customerId: 'c1', amount: 50, description: 'Rateio' },
      { participantId: 'p2', customerId: 'c2', amount: 30, description: 'Rateio' },
    ];
    const plan = planEventSplitRecords(shares, [], eventId);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(2);
    expect(plan.creates).toEqual(
      expect.arrayContaining([
        { customerId: 'c1', amount: 50, description: 'Rateio' },
        { customerId: 'c2', amount: 30, description: 'Rateio' },
      ]),
    );
  });

  it('atualiza (em vez de duplicar) a transação existente do mesmo evento+participante', () => {
    const shares = [
      { participantId: 'p1', customerId: 'c1', amount: 75, description: 'Rateio novo' },
    ];
    const existing = [{ id: 'tx-old', customerId: 'c1', eventId }];
    const plan = planEventSplitRecords(shares, existing, eventId);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toEqual([{ id: 'tx-old', amount: 75, description: 'Rateio novo' }]);
  });

  it('mistura update (participante já tinha registro) e create (participante novo) na mesma reconfirmação', () => {
    const shares = [
      { participantId: 'p1', customerId: 'c1', amount: 75, description: 'Rateio' },
      { participantId: 'p2', customerId: 'c2', amount: 20, description: 'Rateio' },
    ];
    const existing = [{ id: 'tx-old', customerId: 'c1', eventId }];
    const plan = planEventSplitRecords(shares, existing, eventId);
    expect(plan.updates).toEqual([{ id: 'tx-old', amount: 75, description: 'Rateio' }]);
    expect(plan.creates).toEqual([{ customerId: 'c2', amount: 20, description: 'Rateio' }]);
  });

  it('ignora registros de outros eventos ao decidir update vs create', () => {
    const shares = [{ participantId: 'p1', customerId: 'c1', amount: 75, description: 'Rateio' }];
    const existingFromOtherEvent = [{ id: 'tx-other', customerId: 'c1', eventId: 'ev-outro' }];
    const plan = planEventSplitRecords(shares, existingFromOtherEvent, eventId);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toEqual([{ customerId: 'c1', amount: 75, description: 'Rateio' }]);
  });
});

describe('formatDateBR', () => {
  it('formata como DD/MM/AAAA com zero à esquerda', () => {
    expect(formatDateBR(new Date(2026, 0, 5))).toBe('05/01/2026');
  });

  it('formata datas de dois dígitos sem zero desnecessário', () => {
    expect(formatDateBR(new Date(2026, 11, 25))).toBe('25/12/2026');
  });
});
