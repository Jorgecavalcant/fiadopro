import { balanceSign } from './credit';

/** Valor que zera o saldo nesse sentido. Sem saldo nesse sentido, não há o que preencher. */
export function wholeAmount(rawBalance: number, type: 'REFUND' | 'ABATIMENTO'): number | null {
  const cents = Math.round(rawBalance * 100);
  if (type === 'REFUND') {
    if (cents >= 0) return null;
    return Math.abs(cents) / 100;
  }
  if (cents <= 0) return null;
  return cents / 100;
}

/**
 * Texto da confirmação quando o lançamento passa de zero
 * ou quando não há saldo nesse sentido. Null = segue sem perguntar.
 * O sinal vem da regra compartilhada: devolução aumenta, abatimento diminui.
 */
export function pastZeroPrompt(input: {
  type: 'REFUND' | 'ABATIMENTO';
  name: string;
  balance: number;
  amount: number;
  formatCurrency: (value: number) => string;
}): string | null {
  const next =
    Math.round(input.balance * 100) + balanceSign(input.type) * Math.round(input.amount * 100);
  const money = input.formatCurrency;
  if (input.type === 'REFUND') {
    if (Math.round(input.balance * 100) >= 0) {
      return `Você não deve a ${input.name}. Devolver ${money(input.amount)} vira dívida dele (adiantamento). Confirmar?`;
    }
    if (next > 0) {
      return `Você deve ${money(Math.abs(input.balance))} a ${input.name}. Devolver ${money(input.amount)} passa disso e vira dívida dele de ${money(next / 100)}. Confirmar?`;
    }
    return null;
  }
  if (Math.round(input.balance * 100) <= 0) {
    return `${input.name} não deve nada. Abater ${money(input.amount)} vira crédito: você passa a dever a ele. Confirmar?`;
  }
  if (next < 0) {
    return `${input.name} deve ${money(input.balance)}. Abater ${money(input.amount)} passa disso e deixa crédito de ${money(Math.abs(next) / 100)} (você vai dever a ele). Confirmar?`;
  }
  return null;
}
