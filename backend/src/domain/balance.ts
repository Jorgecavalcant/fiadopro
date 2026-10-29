/**
 * Saldo do cliente. Uma regra só, usada pela tela e pelo servidor.
 *
 * Positivo: o cliente deve ao lojista.
 * Negativo: o lojista deve ao cliente (crédito).
 *
 * DEBT aumenta o que o cliente deve.
 * PAYMENT e ABATIMENTO diminuem.
 * REFUND é a devolução em dinheiro que o lojista faz a quem está no crédito.
 * Ela aumenta o saldo e aproxima esse crédito de zero. Não é pagamento.
 *
 * Abatimento é desconto na dívida: entra como ABATIMENTO e diminui o saldo.
 * Acerto de lucro não é um tipo. O botão da tela grava um DEBT no valor do
 * crédito ("Crédito absorvido como lucro"), o que também leva o saldo a zero.
 * A estratégia PROFIT só esconde o saldo negativo na tela. O saldo bruto fica.
 */

export interface LedgerEntry {
  type: string;
  amount: number;
}

/** 1 aumenta o saldo. -1 diminui. Tipo desconhecido não mexe no saldo. */
export function balanceSign(type: string): number {
  if (type === 'DEBT' || type === 'REFUND') return 1;
  if (type === 'PAYMENT' || type === 'ABATIMENTO') return -1;
  return 0;
}

export function computeRawBalance(entries: LedgerEntry[]): number {
  const cents = entries.reduce(
    (total, entry) => total + balanceSign(entry.type) * Math.round(entry.amount * 100),
    0,
  );
  return cents / 100;
}

/** O pagamento passaria do zero e deixaria crédito para o cliente. */
export function paymentLeavesCredit(balance: number, amount: number): boolean {
  return Math.round(balance * 100) - Math.round(amount * 100) < 0;
}

/**
 * Expressão SQL do saldo confirmado. O prefixo é o alias da tabela, com ponto.
 * Exemplo: confirmedBalanceExpr('t.')
 */
export function confirmedBalanceExpr(prefix = ''): string {
  return `COALESCE(SUM(CASE
    WHEN ${prefix}type = 'DEBT' THEN ${prefix}amount
    WHEN ${prefix}type = 'REFUND' THEN ${prefix}amount
    WHEN ${prefix}type IN ('PAYMENT', 'ABATIMENTO') THEN -${prefix}amount
    ELSE 0
  END) FILTER (WHERE ${prefix}status = 'CONFIRMED'), 0)`;
}
