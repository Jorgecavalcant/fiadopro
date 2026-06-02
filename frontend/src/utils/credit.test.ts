import { describe, it, expect } from 'vitest';
import { calculateScore, computeRawBalance, buildChargeMessage, normalizeWhatsAppPhone } from './credit';
import type { Transaction, TransactionType, TransactionStatus } from '../types';

const DAY = 86_400_000;

// Helper para montar transações com defaults sensatos.
let seq = 0;
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: `t${seq++}`,
  customerId: 'c1',
  amount: 100,
  type: 'DEBT' as TransactionType,
  description: 'Compra',
  timestamp: 0,
  status: 'CONFIRMED' as TransactionStatus,
  ...over,
});

describe('calculateScore', () => {
  it('retorna 850 para cliente marcado como confiável', () => {
    expect(calculateScore({ id: 'c1', trusted: true }, [])).toBe(850);
  });

  it('retorna 700 (neutro) quando não há transações confirmadas', () => {
    expect(calculateScore({ id: 'c1' }, [])).toBe(700);
    // transação pendente não conta
    const pending = tx({ status: 'PENDING' });
    expect(calculateScore({ id: 'c1' }, [pending])).toBe(700);
  });

  it('penaliza dívida sem nenhum pagamento (ratio < 0.5 → -80)', () => {
    const debt = tx({ amount: 100, type: 'DEBT' });
    expect(calculateScore({ id: 'c1' }, [debt])).toBe(620);
  });

  it('bonifica pagamento em dia e quitação total (+10 pontualidade, +50 ratio)', () => {
    const debt = tx({ amount: 100, type: 'DEBT', timestamp: 0, dueDate: 10 * DAY });
    const payment = tx({ amount: 100, type: 'PAYMENT', timestamp: 5 * DAY });
    expect(calculateScore({ id: 'c1' }, [debt, payment])).toBe(760);
  });

  it('penaliza atraso superior a 30 dias (-80 pontualidade)', () => {
    const debt = tx({ amount: 100, type: 'DEBT', timestamp: 0, dueDate: 1 * DAY });
    const payment = tx({ amount: 100, type: 'PAYMENT', timestamp: 40 * DAY });
    // 700 -80 (atraso > 30d) +50 (quitou) = 670
    expect(calculateScore({ id: 'c1' }, [debt, payment])).toBe(670);
  });

  it('penaliza saldo em aberto muito alto (> 5000 → -100)', () => {
    const debt = tx({ amount: 6000, type: 'DEBT' });
    // 700 -100 (saldo) -80 (ratio 0) = 520
    expect(calculateScore({ id: 'c1' }, [debt])).toBe(520);
  });

  it('mantém o score dentro do intervalo 0–1000', () => {
    const debts = Array.from({ length: 5 }, () => tx({ amount: 6000, type: 'DEBT' }));
    const score = calculateScore({ id: 'c1' }, debts);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1000);
  });

  it('ignora transações de outros clientes', () => {
    const outro = tx({ customerId: 'c2', amount: 9999, type: 'DEBT' });
    expect(calculateScore({ id: 'c1' }, [outro])).toBe(700);
  });
});

describe('computeRawBalance', () => {
  it('soma DEBT e subtrai PAYMENT/ABATIMENTO/REFUND', () => {
    const list = [
      tx({ amount: 100, type: 'DEBT' }),
      tx({ amount: 30, type: 'PAYMENT' }),
      tx({ amount: 20, type: 'ABATIMENTO' }),
      tx({ amount: 10, type: 'REFUND' }),
    ];
    expect(computeRawBalance(list)).toBe(40);
  });

  it('retorna saldo negativo (crédito) quando pago a mais', () => {
    const list = [tx({ amount: 50, type: 'DEBT' }), tx({ amount: 80, type: 'PAYMENT' })];
    expect(computeRawBalance(list)).toBe(-30);
  });

  it('retorna 0 para lista vazia', () => {
    expect(computeRawBalance([])).toBe(0);
  });
});

describe('buildChargeMessage', () => {
  const fmt = (n: number) => `R$${n.toFixed(2)}`;
  const base = {
    customerName: 'Ana Costa',
    creditorName: 'Mercearia do Zé',
    totalDebt: 100,
    totalPaid: 0,
    recentDebts: [],
    formatCurrency: fmt,
    date: '01/01/2025',
  };

  it('mensagem de devedor inclui nome, credor e saldo devedor', () => {
    const msg = buildChargeMessage({ ...base, balance: 100 });
    expect(msg).toContain('Ana Costa');
    expect(msg).toContain('Mercearia do Zé');
    expect(msg).toContain('Saldo devedor: R$100.00');
    expect(msg).toContain('01/01/2025');
  });

  it('mensagem de crédito quando saldo negativo', () => {
    const msg = buildChargeMessage({ ...base, balance: -30 });
    expect(msg).toContain('Crédito disponível: R$30.00');
    expect(msg).not.toContain('Saldo devedor');
  });

  it('mensagem de conta em dia quando saldo zero', () => {
    const msg = buildChargeMessage({ ...base, balance: 0 });
    expect(msg).toContain('em dia');
  });

  it('inclui chave Pix quando informada (apenas para devedor)', () => {
    const msg = buildChargeMessage({ ...base, balance: 100, pixKey: 'ze@pix.com' });
    expect(msg).toContain('Pix:');
    expect(msg).toContain('ze@pix.com');
  });

  it('lista os lançamentos recentes quando houver', () => {
    const msg = buildChargeMessage({
      ...base,
      balance: 100,
      recentDebts: [{ timestamp: 0, description: 'Pão e leite', amount: 25 }],
    });
    expect(msg).toContain('Lançamentos recentes');
    expect(msg).toContain('Pão e leite');
    expect(msg).toContain('R$25.00');
  });

  it('nunca usa tom agressivo (sem palavras de pressão)', () => {
    const msg = buildChargeMessage({ ...base, balance: 100 }).toLowerCase();
    ['imediatamente', 'urgente', 'regularize já', 'vencida', 'inadimplente'].forEach(palavra => {
      expect(msg).not.toContain(palavra);
    });
  });
});

describe('normalizeWhatsAppPhone', () => {
  it('adiciona DDI 55 quando ausente', () => {
    expect(normalizeWhatsAppPhone('(11) 91111-1111')).toBe('5511911111111');
  });

  it('mantém o número quando já começa com 55', () => {
    expect(normalizeWhatsAppPhone('5511911111111')).toBe('5511911111111');
  });

  it('remove qualquer caractere não numérico', () => {
    expect(normalizeWhatsAppPhone('+55 (11) 99999-9999')).toBe('5511999999999');
  });
});
