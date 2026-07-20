import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import { getUserPlan, maxReportMonths } from './plans.js';

describe('plans.getUserPlan', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('retorna ADMIN quando users.role = admin, mesmo sem assinatura', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ role: 'admin', plan: null, status: null, current_period_end: null }],
    });
    await expect(getUserPlan('user-1')).resolves.toBe('ADMIN');
  });

  it('retorna PRO quando assinatura ativa e dentro da validade', async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    queryMock.mockResolvedValueOnce({
      rows: [{ role: 'user', plan: 'PRO', status: 'active', current_period_end: future }],
    });
    await expect(getUserPlan('user-2')).resolves.toBe('PRO');
  });

  it('retorna FREE quando assinatura PRO esta expirada', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    queryMock.mockResolvedValueOnce({
      rows: [{ role: 'user', plan: 'PRO', status: 'active', current_period_end: past }],
    });
    await expect(getUserPlan('user-3')).resolves.toBe('FREE');
  });

  it('retorna FREE quando status nao esta active (ex: overdue)', async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    queryMock.mockResolvedValueOnce({
      rows: [{ role: 'user', plan: 'PRO', status: 'overdue', current_period_end: future }],
    });
    await expect(getUserPlan('user-4')).resolves.toBe('FREE');
  });

  it('retorna FREE quando usuario nao possui linha de assinatura', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ role: 'user', plan: null, status: null, current_period_end: null }],
    });
    await expect(getUserPlan('user-5')).resolves.toBe('FREE');
  });

  it('retorna FREE (fail-safe) quando a consulta ao banco falha', async () => {
    queryMock.mockRejectedValueOnce(new Error('conexao recusada'));
    await expect(getUserPlan('user-6')).resolves.toBe('FREE');
  });
});

describe('plans.maxReportMonths', () => {
  it('FREE = 6 meses', () => {
    expect(maxReportMonths('FREE')).toBe(6);
  });

  it('PRO = 12 meses', () => {
    expect(maxReportMonths('PRO')).toBe(12);
  });

  it('ADMIN = 60 meses', () => {
    expect(maxReportMonths('ADMIN')).toBe(60);
  });
});
