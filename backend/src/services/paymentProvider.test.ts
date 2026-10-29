import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getPaymentProvider } from './paymentProvider.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('paymentProvider — verifyWebhook', () => {
  const previous = process.env.ASAAS_WEBHOOK_TOKEN;

  afterEach(() => {
    if (previous === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN;
    else process.env.ASAAS_WEBHOOK_TOKEN = previous;
  });

  it('sem token configurado responde 503', () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    expect(getPaymentProvider().verifyWebhook('qualquer')).toEqual({
      ok: false,
      httpStatus: 503,
    });
  });

  it('token errado responde 401', () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-certo';
    expect(getPaymentProvider().verifyWebhook('token-errado')).toEqual({
      ok: false,
      httpStatus: 401,
    });
    expect(getPaymentProvider().verifyWebhook('a')).toEqual({ ok: false, httpStatus: 401 });
    expect(getPaymentProvider().verifyWebhook(undefined)).toEqual({ ok: false, httpStatus: 401 });
  });

  it('token certo responde ok', () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-certo';
    expect(getPaymentProvider().verifyWebhook('token-certo')).toEqual({ ok: true });
  });
});

describe('paymentProvider — arquivos nao chamam o provedor direto', () => {
  it('billing.ts nao importa asaas.js', () => {
    const source = readFileSync(path.join(here, '../routes/billing.ts'), 'utf8');
    expect(source).not.toContain("from '../services/asaas");
    expect(source).not.toContain("from './asaas");
  });

  it('plans.ts nao contem asaas', () => {
    const source = readFileSync(path.join(here, 'plans.ts'), 'utf8');
    expect(source).not.toContain('asaas');
  });
});
