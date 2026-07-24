import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const queryMock = vi.fn();

vi.mock('../config/database.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

vi.mock('../services/asaas.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/asaas.js')>();
  return {
    ...actual,
    createCustomer: vi.fn(),
    createSubscription: vi.fn(),
    getSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  };
});

import {
  webhookHandler,
  subscribeHandler,
  cancelHandler,
  classifyBillingEvent,
  timingSafeEqualString,
  isValidCpfCnpj,
} from './billing.js';
import * as asaasService from '../services/asaas.js';

function fakeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('billing — helpers puros', () => {
  it('classifyBillingEvent: eventos de pagamento confirmado ativam PRO', () => {
    expect(classifyBillingEvent('PAYMENT_CONFIRMED')).toBe('ACTIVATE');
    expect(classifyBillingEvent('PAYMENT_RECEIVED')).toBe('ACTIVATE');
  });

  it('classifyBillingEvent: overdue/refunded/deleted desativam PRO', () => {
    expect(classifyBillingEvent('PAYMENT_OVERDUE')).toBe('DEACTIVATE');
    expect(classifyBillingEvent('PAYMENT_REFUNDED')).toBe('DEACTIVATE');
    expect(classifyBillingEvent('SUBSCRIPTION_DELETED')).toBe('DEACTIVATE');
  });

  it('classifyBillingEvent: eventos desconhecidos nao alteram plano', () => {
    expect(classifyBillingEvent('PAYMENT_CREATED')).toBeNull();
  });

  it('timingSafeEqualString: aceita token correto e recusa incorreto/ausente', () => {
    expect(timingSafeEqualString('segredo-123', 'segredo-123')).toBe(true);
    expect(timingSafeEqualString('errado', 'segredo-123')).toBe(false);
    expect(timingSafeEqualString(undefined, 'segredo-123')).toBe(false);
    expect(timingSafeEqualString('segredo-123', undefined)).toBe(false);
    // tamanhos diferentes tambem devem ser recusados (sem lancar excecao)
    expect(timingSafeEqualString('a', 'muito-mais-longo')).toBe(false);
  });

  it('isValidCpfCnpj: aceita 11 ou 14 digitos, recusa o resto', () => {
    expect(isValidCpfCnpj('123.456.789-00')).toBe(true);
    expect(isValidCpfCnpj('12.345.678/0001-00')).toBe(true);
    expect(isValidCpfCnpj('123')).toBe(false);
  });
});

describe('billing — webhookHandler', () => {
  beforeEach(() => {
    queryMock.mockReset();
    process.env.ASAAS_WEBHOOK_TOKEN = 'webhook-secret-token';
  });

  it('recusa quando o token do header esta incorreto', async () => {
    const req: any = { headers: { 'asaas-access-token': 'token-errado' }, body: {} };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('recusa quando o header esta ausente', async () => {
    const req: any = { headers: {}, body: {} };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responde 503 quando ASAAS_WEBHOOK_TOKEN nao esta configurado no servidor', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    const req: any = { headers: { 'asaas-access-token': 'qualquer' }, body: {} };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    process.env.ASAAS_WEBHOOK_TOKEN = 'webhook-secret-token';
  });

  it('PAYMENT_CONFIRMED com token correto ativa PRO com validade de 32 dias', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // UPDATE nao retorna rows relevantes
    const req: any = {
      headers: { 'asaas-access-token': 'webhook-secret-token' },
      body: { event: 'PAYMENT_CONFIRMED', payment: { subscription: 'sub_1' } },
    };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("plan = 'PRO'");
    expect(sql).toContain("status = 'active'");
    expect(params[1]).toBe('sub_1');
    const periodEnd = params[0] as Date;
    const diffDays = (periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(31);
    expect(diffDays).toBeLessThan(33);
  });

  it('PAYMENT_OVERDUE volta o plano para FREE', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const req: any = {
      headers: { 'asaas-access-token': 'webhook-secret-token' },
      body: { event: 'PAYMENT_OVERDUE', payment: { subscription: 'sub_2' } },
    };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("plan = 'FREE'");
    expect(params[0]).toBe('overdue');
    expect(params[1]).toBe('sub_2');
  });

  it('SUBSCRIPTION_DELETED volta o plano para FREE com status canceled', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const req: any = {
      headers: { 'asaas-access-token': 'webhook-secret-token' },
      body: { event: 'SUBSCRIPTION_DELETED', payment: { subscription: 'sub_3' } },
    };
    const res = fakeRes();

    await webhookHandler(req, res);

    const [, params] = queryMock.mock.calls[0];
    expect(params[0]).toBe('canceled');
  });

  it('e idempotente: aplicar o mesmo evento duas vezes gera o mesmo UPDATE, sem duplicar efeitos', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const req: any = {
      headers: { 'asaas-access-token': 'webhook-secret-token' },
      body: { event: 'PAYMENT_CONFIRMED', payment: { subscription: 'sub_4' } },
    };

    await webhookHandler(req, fakeRes());
    await webhookHandler(req, fakeRes());

    expect(queryMock).toHaveBeenCalledTimes(2);
    const [sql1] = queryMock.mock.calls[0];
    const [sql2] = queryMock.mock.calls[1];
    expect(sql1).toBe(sql2); // mesmo UPDATE idempotente, so muda o timestamp de execucao
  });

  it('evento sem assinatura vinculada ou desconhecido responde 200 rapido sem tocar o banco', async () => {
    const req: any = {
      headers: { 'asaas-access-token': 'webhook-secret-token' },
      body: { event: 'PAYMENT_CREATED', payment: { subscription: 'sub_5' } },
    };
    const res = fakeRes();

    await webhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('billing — subscribeHandler', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.mocked(asaasService.createCustomer).mockReset();
    vi.mocked(asaasService.createSubscription).mockReset();
    vi.mocked(asaasService.getSubscription).mockReset();
  });

  it('retorna 400 quando usuario nao tem CPF cadastrado nem enviado no body', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u1', full_name: 'Fulano', email: 'f@x.com', cpf: null }],
    });
    const req: any = { user: { sub: 'u1', email: 'f@x.com' }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await subscribeHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('CPF_REQUIRED');
  });

  it('retorna 503 "Pagamentos nao configurados" quando ASAAS_API_KEY ausente (AsaasNotConfiguredError)', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'u2', full_name: 'Fulano', email: 'f@x.com', cpf: '12345678900' }],
    });
    vi.mocked(asaasService.createCustomer).mockRejectedValueOnce(
      new asaasService.AsaasNotConfiguredError(),
    );
    const req: any = { user: { sub: 'u2', email: 'f@x.com' }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await subscribeHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(503);
    expect(err.message).toBe('Pagamentos nao configurados');
  });

  it('cria assinatura com sucesso e retorna invoiceUrl', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'u3', full_name: 'Fulano', email: 'f@x.com', cpf: '12345678900' }],
      }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }); // SELECT subscriptions (nao existente -> INSERT)
    vi.mocked(asaasService.createCustomer).mockResolvedValueOnce({ id: 'cus_1' } as any);
    vi.mocked(asaasService.createSubscription).mockResolvedValueOnce({
      id: 'sub_1',
      status: 'PENDING',
    } as any);
    vi.mocked(asaasService.getSubscription).mockResolvedValueOnce({
      id: 'sub_1',
      status: 'PENDING',
      invoiceUrl: 'https://asaas.com/i/xyz',
    } as any);
    queryMock.mockResolvedValueOnce({ rows: [] }); // INSERT subscriptions

    const req: any = { user: { sub: 'u3', email: 'f@x.com' }, body: {} };
    const res = fakeRes();
    const next = vi.fn();

    await subscribeHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, invoiceUrl: 'https://asaas.com/i/xyz' }),
    );
  });
});

describe('billing — cancelHandler', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.mocked(asaasService.cancelSubscription).mockReset();
  });

  it('retorna 404 quando o usuario nao tem assinatura vinculada ao Asaas', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const req: any = { user: { sub: 'u1' } };
    const res = fakeRes();
    const next = vi.fn();

    await cancelHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe('NO_SUBSCRIPTION');
    expect(asaasService.cancelSubscription).not.toHaveBeenCalled();
  });

  it('e idempotente: se ja estava cancelada, nao chama o Asaas de novo', async () => {
    const periodEnd = new Date('2026-08-01T00:00:00Z');
    queryMock.mockResolvedValueOnce({
      rows: [
        { asaas_subscription_id: 'sub_9', current_period_end: periodEnd, canceled_at: new Date() },
      ],
    });
    const req: any = { user: { sub: 'u2' } };
    const res = fakeRes();
    const next = vi.fn();

    await cancelHandler(req, res, next);

    expect(asaasService.cancelSubscription).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, currentPeriodEnd: periodEnd }),
    );
  });

  it('cancela no Asaas e marca canceled_at, mantendo current_period_end (carencia)', async () => {
    const periodEnd = new Date('2026-08-01T00:00:00Z');
    queryMock
      .mockResolvedValueOnce({
        rows: [
          { asaas_subscription_id: 'sub_10', current_period_end: periodEnd, canceled_at: null },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE canceled_at
    vi.mocked(asaasService.cancelSubscription).mockResolvedValueOnce(undefined);
    const req: any = { user: { sub: 'u3' } };
    const res = fakeRes();
    const next = vi.fn();

    await cancelHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(asaasService.cancelSubscription).toHaveBeenCalledWith('sub_10');
    const [updateSql] = queryMock.mock.calls[1];
    expect(updateSql).toContain('canceled_at = NOW()');
    expect(updateSql).not.toContain('plan ='); // nao mexe no plano — a carencia e natural
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, currentPeriodEnd: periodEnd }),
    );
  });

  it('retorna 503 quando Asaas nao esta configurado', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ asaas_subscription_id: 'sub_11', current_period_end: null, canceled_at: null }],
    });
    vi.mocked(asaasService.cancelSubscription).mockRejectedValueOnce(
      new asaasService.AsaasNotConfiguredError(),
    );
    const req: any = { user: { sub: 'u4' } };
    const res = fakeRes();
    const next = vi.fn();

    await cancelHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(503);
  });
});
