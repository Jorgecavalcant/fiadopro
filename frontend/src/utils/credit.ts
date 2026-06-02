// Lógica de crédito pura (sem React, sem DOM) — extraída do App.tsx para ser testável.
// Estas funções são a fonte única de verdade do cálculo de score, saldo e mensagem de cobrança.
import type { Transaction } from '../types';

/**
 * Score de crédito (0–1000) de um cliente, com base no histórico de transações CONFIRMADAS.
 * Considera pontualidade de pagamento, saldo em aberto e razão pago/devido.
 */
export const calculateScore = (
  customer: { id: string; trusted?: boolean },
  transactions: Transaction[]
): number => {
  if (customer.trusted) return 850;
  const cTx = transactions.filter(t => t.customerId === customer.id && t.status === 'CONFIRMED');
  if (cTx.length === 0) return 700;
  let score = 700;
  const debts = cTx.filter(t => t.type === 'DEBT');
  const payments = cTx.filter(t => t.type === 'PAYMENT' || t.type === 'ABATIMENTO');
  // Avalia pontualidade: compara data do pagamento com o dueDate do débito mais próximo
  payments.forEach(payment => {
    const relatedDebt = debts
      .filter(d => d.dueDate && d.timestamp <= payment.timestamp)
      .sort((a, b) => Math.abs(a.timestamp - payment.timestamp) - Math.abs(b.timestamp - payment.timestamp))[0];
    if (relatedDebt?.dueDate) {
      const daysDiff = (relatedDebt.dueDate - payment.timestamp) / 86400000;
      if (daysDiff > 7) score += 20;        // Pagou muito antes do vencimento
      else if (daysDiff >= 0) score += 10;  // Pagou no prazo
      else if (daysDiff > -7) score -= 15;  // Atrasou até 7 dias
      else if (daysDiff > -30) score -= 40; // Atrasou até 30 dias
      else score -= 80;                      // Atrasou mais de 30 dias
    }
  });
  const currentBalance = cTx.reduce((acc, t) =>
    t.type === 'DEBT' ? acc + t.amount : acc - t.amount, 0);
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
 * DEBT aumenta o saldo (cliente deve mais); PAYMENT/ABATIMENTO/REFUND reduzem.
 * Saldo negativo significa crédito a favor do cliente.
 */
export const computeRawBalance = (customerConfirmedTransactions: Transaction[]): number =>
  customerConfirmedTransactions.reduce(
    (acc, curr) => (curr.type === 'DEBT' ? acc + curr.amount : acc - curr.amount),
    0
  );

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

/**
 * Monta a mensagem de cobrança amigável enviada via WhatsApp.
 * Tom acolhedor e sem pressão (DNA Tech42), de acordo com o saldo do cliente.
 */
export const buildChargeMessage = (params: ChargeMessageParams): string => {
  const { customerName, creditorName, balance, totalDebt, totalPaid, recentDebts, pixKey, formatCurrency } = params;
  const date = params.date ?? new Date().toLocaleDateString('pt-BR');
  const pixInfo = pixKey ? `\n💳 *Pix:* ${pixKey}` : '';

  let recentList = '';
  if (recentDebts.length > 0) {
    recentList = '\n\n📋 *Lançamentos recentes:*\n' + recentDebts.map(t =>
      `• ${new Date(t.timestamp).toLocaleDateString('pt-BR')} — ${t.description}: ${formatCurrency(t.amount)}`
    ).join('\n');
  }

  if (balance > 0) {
    return `Olá ${customerName}! 😊\n\nPassando para lembrar do seu saldo em aberto com *${creditorName}*.\n\n📊 *Resumo da Conta — ${date}*\n💸 Total de débitos: ${formatCurrency(totalDebt)}\n✅ Total pago: ${formatCurrency(totalPaid)}\n⚠️ *Saldo devedor: ${formatCurrency(balance)}*${recentList}${pixInfo}\n\nQualquer dúvida, é só me chamar! 🙏\nObrigado(a)!`;
  }
  if (balance < 0) {
    return `Olá ${customerName}! 😊\n\nBoa notícia! Você tem um crédito com *${creditorName}*.\n\n💰 *Crédito disponível: ${formatCurrency(Math.abs(balance))}*\n\nEntre em contato para acertarmos! 🤝`;
  }
  return `Olá ${customerName}! 😊\n\nSua conta com *${creditorName}* está em dia! ✅\n\nObrigado pela confiança! 🙏`;
};

/** Normaliza um telefone brasileiro para o formato aceito pelo wa.me (com DDI 55). */
export const normalizeWhatsAppPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
};
