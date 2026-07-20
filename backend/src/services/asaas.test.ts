import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCustomer, createSubscription, getSubscription, AsaasNotConfiguredError, AsaasRequestError } from './asaas.js';

const FAKE_KEY = 'sk_test_super_secret_key_12345';

describe('asaas service', () => {
  const originalApiKey = process.env.ASAAS_API_KEY;
  const originalBaseUrl = process.env.ASAAS_BASE_URL;
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error - stub global fetch para o teste, sem rede real.
    global.fetch = fetchMock;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.ASAAS_API_KEY = originalApiKey;
    process.env.ASAAS_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  it('lanca AsaasNotConfiguredError quando ASAAS_API_KEY nao esta definida, sem chamar fetch', async () => {
    delete process.env.ASAAS_API_KEY;

    await expect(
      createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '12345678900' })
    ).rejects.toBeInstanceOf(AsaasNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createCustomer envia access_token no header e cpfCnpj so com digitos', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    process.env.ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'cus_000001' }),
    });

    const result = await createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '123.456.789-00' });

    expect(result.id).toBe('cus_000001');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api-sandbox.asaas.com/v3/customers');
    expect(init.method).toBe('POST');
    expect(init.headers.access_token).toBe(FAKE_KEY);
    expect(JSON.parse(init.body).cpfCnpj).toBe('12345678900');
  });

  it('createSubscription usa billingType UNDEFINED e cycle MONTHLY', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'sub_000001', status: 'PENDING' }),
    });

    const result = await createSubscription({ customer: 'cus_000001', value: 19.9, nextDueDate: '2026-07-20' });

    expect(result.id).toBe('sub_000001');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.billingType).toBe('UNDEFINED');
    expect(body.cycle).toBe('MONTHLY');
    expect(body.customer).toBe('cus_000001');
  });

  it('getSubscription faz GET em /subscriptions/{id}', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    process.env.ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3';
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'sub_000001', status: 'ACTIVE', invoiceUrl: 'https://asaas.com/i/abc' }),
    });

    const result = await getSubscription('sub_000001');

    expect(result.invoiceUrl).toBe('https://asaas.com/i/abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api-sandbox.asaas.com/v3/subscriptions/sub_000001');
    expect(init.method).toBe('GET');
  });

  it('mapeia erro de resposta do Asaas para mensagem amigavel, sem vazar a chave', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ errors: [{ code: 'invalid_cpfCnpj', description: 'CPF invalido' }] }),
    });

    await expect(
      createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '000' })
    ).rejects.toThrow('CPF invalido');

    try {
      await createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '000' });
      expect.unreachable('deveria ter lancado');
    } catch (err) {
      expect(err).toBeInstanceOf(AsaasRequestError);
      expect((err as Error).message).not.toContain(FAKE_KEY);
    }
  });

  it('mapeia falha de rede (fetch rejeitado) para mensagem amigavel', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '12345678900' })
    ).rejects.toThrow('Nao foi possivel conectar ao Asaas');
  });

  it('nunca loga a chave de API, mesmo em cenarios de erro', async () => {
    process.env.ASAAS_API_KEY = FAKE_KEY;
    fetchMock.mockRejectedValue(new Error('boom'));

    await expect(
      createCustomer({ name: 'Fulano', email: 'fulano@example.com', cpfCnpj: '12345678900' })
    ).rejects.toThrow();

    const allLoggedText = JSON.stringify([...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]);
    expect(allLoggedText).not.toContain(FAKE_KEY);
  });
});
