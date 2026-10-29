import { describe, expect, it } from 'vitest';
import {
  computeRawBalance,
  confirmedBalanceExpr,
  paymentLeavesCredit,
} from './balance.js';

describe('saldo compartilhado', () => {
  it('dívida 75, pagamento 500, devolução 425 e nova dívida 100', () => {
    const depoisDoPagamento = computeRawBalance([
      { type: 'DEBT', amount: 75 },
      { type: 'PAYMENT', amount: 500 },
    ]);
    expect(depoisDoPagamento).toBe(-425);
    expect(paymentLeavesCredit(75, 500)).toBe(true);

    const depoisDaDevolucao = computeRawBalance([
      { type: 'DEBT', amount: 75 },
      { type: 'PAYMENT', amount: 500 },
      { type: 'REFUND', amount: 425 },
    ]);
    expect(depoisDaDevolucao).toBe(0);

    const saldoDaNovaDivida = computeRawBalance([
      { type: 'DEBT', amount: 75 },
      { type: 'PAYMENT', amount: 500 },
      { type: 'REFUND', amount: 425 },
      { type: 'DEBT', amount: 100 },
    ]);
    expect(saldoDaNovaDivida).toBe(100);
    expect(paymentLeavesCredit(saldoDaNovaDivida, 100)).toBe(false);
  });

  it('abatimento diminui o saldo, como o pagamento', () => {
    expect(
      computeRawBalance([
        { type: 'DEBT', amount: 100 },
        { type: 'ABATIMENTO', amount: 40 },
      ]),
    ).toBe(60);
  });

  it('a expressão SQL soma dívida e devolução e subtrai pagamento e abatimento', () => {
    const sql = confirmedBalanceExpr();
    expect(sql).toContain("WHEN type = 'DEBT' THEN amount");
    expect(sql).toContain("WHEN type = 'REFUND' THEN amount");
    expect(sql).toContain("WHEN type IN ('PAYMENT', 'ABATIMENTO') THEN -amount");
    expect(sql).not.toContain('ELSE -amount');
  });
});
