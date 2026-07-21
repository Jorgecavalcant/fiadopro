import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFinancialAdvice, getGeneralBusinessAdvice, extractItemsFromInvoice } from './aiService';
import type { CustomerWithBalance, Transaction } from '../types';

describe('aiService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getFinancialAdvice', () => {
    it('chama /api/ai/analyze-customer com credentials include e mode=customer', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, analysis: 'Risco baixo.' }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;

      const customer: CustomerWithBalance = {
        id: 'c1', name: 'Maria', phone: '11999999999', createdAt: 0,
        balance: 100, rawBalance: 100, lastActivity: 0, isOverdue: false,
      };
      const transactions: Transaction[] = [
        { id: 't1', customerId: 'c1', amount: 100, type: 'DEBT', description: 'Fiado', timestamp: 1, status: 'CONFIRMED' },
        { id: 't2', customerId: 'other', amount: 50, type: 'DEBT', description: 'Outro cliente', timestamp: 1, status: 'CONFIRMED' },
      ];

      const result = await getFinancialAdvice(customer, transactions, 'pt-BR');

      expect(result).toBe('Risco baixo.');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/ai/analyze-customer');
      expect(init.credentials).toBe('include');

      const body = JSON.parse(init.body as string);
      expect(body.mode).toBe('customer');
      expect(body.customer.name).toBe('Maria');
      // Só as transações do cliente selecionado (filtra por customerId).
      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0].description).toBe('Fiado');
      expect(body.language).toBe('pt-BR');
    });

    it('lança erro amigável quando o backend responde com erro', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: 'AI_NOT_CONFIGURED', message: 'IA não configurada' } }),
      }) as unknown as typeof fetch;

      const customer: CustomerWithBalance = {
        id: 'c1', name: 'Maria', phone: '11999999999', createdAt: 0,
        balance: 100, rawBalance: 100, lastActivity: 0, isOverdue: false,
      };

      await expect(getFinancialAdvice(customer, [], 'pt-BR')).rejects.toThrow('IA não configurada');
    });
  });

  describe('getGeneralBusinessAdvice', () => {
    it('chama /api/ai/analyze-customer com mode=business e stats', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, analysis: 'Dica 1, dica 2, dica 3.' }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;

      const result = await getGeneralBusinessAdvice(1500.5, 12, 'pt-BR');

      expect(result).toBe('Dica 1, dica 2, dica 3.');
      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.mode).toBe('business');
      expect(body.stats).toEqual({ totalReceivable: 1500.5, activeCustomers: 12 });
      expect(body.customer).toBeUndefined();
    });
  });

  describe('extractItemsFromInvoice', () => {
    it('remove o prefixo data URI antes de enviar e retorna items', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, items: [{ name: 'Picanha', price: 45.9 }] }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;

      const items = await extractItemsFromInvoice('data:image/jpeg;base64,AAAA', 'image/jpeg');

      expect(items).toEqual([{ name: 'Picanha', price: 45.9 }]);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/ai/read-document');
      const body = JSON.parse(init.body as string);
      expect(body.image.data).toBe('AAAA');
      expect(body.image.mimeType).toBe('image/jpeg');
    });

    it('retorna array vazio quando o backend não encontra itens', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

      const items = await extractItemsFromInvoice('AAAA', 'image/png');
      expect(items).toEqual([]);
    });
  });
});
