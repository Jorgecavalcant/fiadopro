// Lógica de crédito pura (sem React, sem DOM) — extraída do App.tsx para ser testável.
// O saldo vem de uma função só, a mesma do servidor.
import type { Transaction } from '../types';
import { balanceSign, computeRawBalance as ledgerBalance } from '../../../backend/src/domain/balance.ts';

export { balanceSign };

/**
 * Score de crédito (0–1000) de um cliente, com base no histórico de transações CONFIRMADAS.
 * Considera pontualidade de pagamento, saldo em aberto e razão pago/devido.
 */
export const calculateScore = (
  customer: { id: string; trusted?: boolean },
  transactions: Transaction[],
): number => {
  if (customer.trusted) return 850;
  const cTx = transactions.filter((t) => t.customerId === customer.id && t.status === 'CONFIRMED');
  if (cTx.length === 0) return 700;
  let score = 700;
  const debts = cTx.filter((t) => t.type === 'DEBT');
  const payments = cTx.filter((t) => t.type === 'PAYMENT' || t.type === 'ABATIMENTO');
  // Avalia pontualidade: compara data do pagamento com o dueDate do débito mais próximo
  payments.forEach((payment) => {
    const relatedDebt = debts
      .filter((d) => d.dueDate && d.timestamp <= payment.timestamp)
      .sort(
        (a, b) =>
          Math.abs(a.timestamp - payment.timestamp) - Math.abs(b.timestamp - payment.timestamp),
      )[0];
    if (relatedDebt?.dueDate) {
      const daysDiff = (relatedDebt.dueDate - payment.timestamp) / 86400000;
      if (daysDiff > 7)
        score += 20; // Pagou muito antes do vencimento
      else if (daysDiff >= 0)
        score += 10; // Pagou no prazo
      else if (daysDiff > -7)
        score -= 15; // Atrasou até 7 dias
      else if (daysDiff > -30)
        score -= 40; // Atrasou até 30 dias
      else score -= 80; // Atrasou mais de 30 dias
    }
  });
  const currentBalance = ledgerBalance(cTx);
  if (currentBalance > 5000) score -= 100;
  else if (currentBalance > 1000) score -= 50;
  const totalDebtAmt = debts.reduce((a, b) => a + b.amount, 0);
  const totalPaidAmt = payments.reduce((a, b) => a + b.amount, 0);
  const paymentRatio = totalDebtAmt > 0 ? Math.min(totalPaidAmt / totalDebtAmt, 1) : 1;
  if (paymentRatio >= 0.95) score += 50;
  else if (paymentRatio >= 0.8) score += 20;
  else if (paymentRatio < 0.5) score -= 80;
  return Math.max(0, Math.min(1000, Math.round(score)));
};

/**
 * Saldo bruto de um cliente a partir das transações CONFIRMADAS já filtradas para ele.
 * DEBT e REFUND aumentam. PAYMENT e ABATIMENTO diminuem.
 * Saldo negativo significa crédito a favor do cliente.
 */
export const computeRawBalance = (customerConfirmedTransactions: Transaction[]): number =>
  ledgerBalance(customerConfirmedTransactions);

export interface ChargeMessageParams {
  customerName: string;
  creditorName: string;
  /** Saldo bruto: > 0 devedor, < 0 crédito a favor do cliente, 0 em dia. */
  balance: number;
  totalDebt: number;
  totalPaid: number;
  /** Até 3 débitos recentes, já ordenados do mais novo para o mais antigo. */
  recentDebts: { timestamp: number; description: string; amount: number }[];
  pixKey?: string;
  formatCurrency: (amount: number) => string;
  /** Data formatada (pt-BR). Default: hoje. */
  date?: string;
}

/** Emojis da cobrança — mesmos de sempre, via code point (UTF-8 seguro no fonte). */
export const CHARGE_EMOJI = {
  smile: '\u{1F60A}',
  chart: '\u{1F4CA}',
  moneyWings: '\u{1F4B8}',
  check: '\u{2705}',
  warning: '\u{26A0}\u{FE0F}',
  clipboard: '\u{1F4CB}',
  card: '\u{1F4B3}',
  thanks: '\u{1F64F}',
  moneyBag: '\u{1F4B0}',
  handshake: '\u{1F91D}',
} as const;

/**
 * Monta a mensagem de cobrança amigável enviada via WhatsApp.
 * Tom acolhedor e sem pressão (DNA Tech42), de acordo com o saldo do cliente.
 */
export const buildChargeMessage = (params: ChargeMessageParams): string => {
  const {
    customerName,
    creditorName,
    balance,
    totalDebt,
    totalPaid,
    recentDebts,
    pixKey,
    formatCurrency,
  } = params;
  const date = params.date ?? new Date().toLocaleDateString('pt-BR');
  const pixInfo = pixKey ? `\n${CHARGE_EMOJI.card} *Pix:* ${pixKey}` : '';

  let recentList = '';
  if (recentDebts.length > 0) {
    recentList =
      `\n\n${CHARGE_EMOJI.clipboard} *Lançamentos recentes:*\n` +
      recentDebts
        .map(
          (t) =>
            `• ${new Date(t.timestamp).toLocaleDateString('pt-BR')} — ${t.description}: ${formatCurrency(t.amount)}`,
        )
        .join('\n');
  }

  if (balance > 0) {
    return `Olá ${customerName}! ${CHARGE_EMOJI.smile}\n\nPassando para lembrar do seu saldo em aberto com *${creditorName}*.\n\n${CHARGE_EMOJI.chart} *Resumo da Conta — ${date}*\n${CHARGE_EMOJI.moneyWings} Total de débitos: ${formatCurrency(totalDebt)}\n${CHARGE_EMOJI.check} Total pago: ${formatCurrency(totalPaid)}\n${CHARGE_EMOJI.warning} *Saldo devedor: ${formatCurrency(balance)}*${recentList}${pixInfo}\n\nQualquer dúvida, é só me chamar! ${CHARGE_EMOJI.thanks}\nObrigado(a)!`;
  }
  if (balance < 0) {
    return `Olá ${customerName}! ${CHARGE_EMOJI.smile}\n\nBoa notícia! Você tem um crédito com *${creditorName}*.\n\n${CHARGE_EMOJI.moneyBag} *Crédito disponível: ${formatCurrency(Math.abs(balance))}*\n\nEntre em contato para acertarmos! ${CHARGE_EMOJI.handshake}`;
  }
  return `Olá ${customerName}! ${CHARGE_EMOJI.smile}\n\nSua conta com *${creditorName}* está em dia! ${CHARGE_EMOJI.check}\n\nObrigado pela confiança! ${CHARGE_EMOJI.thanks}`;
};

/** Normaliza um telefone brasileiro para o formato aceito pelo WhatsApp (com DDI 55). */
export const normalizeWhatsAppPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
};

/**
 * Monta o link de click-to-chat.
 * Usa api.whatsapp.com/send — o atalho wa.me redireciona e troca emoji de 4 bytes por U+FFFD (�).
 * O texto inteiro vai uma vez só em encodeURIComponent; sem cortar caracteres.
 */
export const buildWhatsAppUrl = (phone: string, text: string): string => {
  const waPhone = normalizeWhatsAppPhone(phone);
  return `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(text)}`;
};
