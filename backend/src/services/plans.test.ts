import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

import {
  ENTERPRISE_REFERENCE_PRICE,
  PRO_MONTHLY_PRICE,
  TRIAL_DAYS,
  adPolicyFor,
  getUserPlan,
  maxReportMonths,
  publicPlanPrices,
  resolveEffectivePlan,
} from './plans.js';

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

  it('ENTERPRISE = 60 meses', () => {
    expect(maxReportMonths('ENTERPRISE')).toBe(60);
  });

  it('ADMIN = 60 meses', () => {
    expect(maxReportMonths('ADMIN')).toBe(60);
  });
});

describe('plans — preço e anúncio', () => {
  it('cobra 30 no Pro e não publica o 97 do Enterprise', () => {
    expect(PRO_MONTHLY_PRICE).toBe(30);
    expect(ENTERPRISE_REFERENCE_PRICE).toBe(97);
    expect(TRIAL_DAYS).toBe(14);
    expect(publicPlanPrices()).toEqual({ free: 0, pro: 30 });
    expect(publicPlanPrices()).not.toHaveProperty('enterprise');
  });

  it('define a regra de anúncio sem desenhar a peça', () => {
    expect(adPolicyFor('FREE')).toBe('fullscreen_and_top');
    expect(adPolicyFor('PRO')).toBe('local_sponsor');
    expect(adPolicyFor('ENTERPRISE')).toBe('none');
    expect(adPolicyFor('ADMIN')).toBe('none');
  });
});

describe('plans.resolveEffectivePlan', () => {
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const base = {
    role: 'user',
    plan: 'FREE',
    status: null as string | null,
    current_period_end: null as string | null,
  };

  it('pago e vigente libera PRO', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        plan: 'PRO',
        status: 'active',
        current_period_end: future,
      }),
    ).toBe('PRO');
  });

  it('pago vencido bloqueia e volta ao Free', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        plan: 'PRO',
        status: 'active',
        current_period_end: past,
      }),
    ).toBe('FREE');
  });

  it('Enterprise pago e vigente libera Enterprise, sem virar admin', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        plan: 'ENTERPRISE',
        status: 'active',
        current_period_end: future,
      }),
    ).toBe('ENTERPRISE');
  });

  it('cortesia vigente fica acima do Pro pago', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        plan: 'PRO',
        status: 'active',
        current_period_end: future,
        grant_plan: 'ENTERPRISE',
        grant_source: 'cortesia',
        grant_expires_at: future,
      }),
    ).toBe('ENTERPRISE');
  });

  it('cortesia vencida volta ao plano pago que ainda vale', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        plan: 'PRO',
        status: 'active',
        current_period_end: future,
        grant_plan: 'ENTERPRISE',
        grant_source: 'cortesia',
        grant_expires_at: past,
      }),
    ).toBe('PRO');
  });

  it('teste vencido volta ao Free quando não há assinatura paga', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        grant_plan: 'PRO',
        grant_source: 'trial',
        grant_expires_at: past,
      }),
    ).toBe('FREE');
  });

  it('teste sem data não libera', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        grant_plan: 'PRO',
        grant_source: 'trial',
        grant_expires_at: null,
      }),
    ).toBe('FREE');
  });

  it('teste dentro de 14 dias libera e expira sozinho depois', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        grant_plan: 'PRO',
        grant_source: 'trial',
        grant_expires_at: future,
      }),
    ).toBe('PRO');
  });

  it('promoção vigente sobe quem está no Free', () => {
    expect(resolveEffectivePlan({ ...base, promotion_plan: 'PRO' })).toBe('PRO');
  });

  it('papel admin continua admin mesmo com concessão', () => {
    expect(
      resolveEffectivePlan({
        ...base,
        role: 'admin',
        grant_plan: 'ENTERPRISE',
        grant_source: 'cortesia',
        grant_expires_at: future,
      }),
    ).toBe('ADMIN');
  });
});
