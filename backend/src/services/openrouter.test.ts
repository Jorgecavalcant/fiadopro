import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock de `query` (config/database.js) — nunca toca banco de verdade.
const queryMock = vi.fn();
vi.mock('../config/database.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

describe('openrouter service', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  describe('getAiConfig', () => {
    it('retorna defaults gratuitos quando a tabela ainda não tem linha', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });
      const { getAiConfig, DEFAULT_CHAT_MODEL, DEFAULT_VISION_MODEL } = await import('./openrouter.js');

      const config = await getAiConfig();
      expect(config).toEqual({ chatModel: DEFAULT_CHAT_MODEL, visionModel: DEFAULT_VISION_MODEL, enabled: true });
    });

    it('retorna defaults quando a query falha (banco fora do ar)', async () => {
      queryMock.mockRejectedValueOnce(new Error('connection refused'));
      const { getAiConfig, DEFAULT_CHAT_MODEL, DEFAULT_VISION_MODEL } = await import('./openrouter.js');

      const config = await getAiConfig();
      expect(config).toEqual({ chatModel: DEFAULT_CHAT_MODEL, visionModel: DEFAULT_VISION_MODEL, enabled: true });
    });

    it('usa os valores configurados quando a linha existe', async () => {
      queryMock.mockResolvedValueOnce({
        rows: [{ chat_model: 'custom/chat-model', vision_model: 'custom/vision-model', enabled: false }],
      });
      const { getAiConfig } = await import('./openrouter.js');

      const config = await getAiConfig();
      expect(config).toEqual({ chatModel: 'custom/chat-model', visionModel: 'custom/vision-model', enabled: false });
    });
  });

  describe('chatCompletion / visionCompletion — erro sem chave', () => {
    it('lança 503 AI_NOT_CONFIGURED quando OPENROUTER_API_KEY não está definida', async () => {
      delete process.env.OPENROUTER_API_KEY;
      queryMock.mockResolvedValue({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      const { chatCompletion, OpenRouterError } = await import('./openrouter.js');

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 503,
        code: 'AI_NOT_CONFIGURED',
      });
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toBeInstanceOf(OpenRouterError);
      // Nunca deve tentar chamar a rede sem chave.
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('lança 503 AI_DISABLED quando ai_config.enabled = false, mesmo com chave presente', async () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: false }] });
      const { chatCompletion } = await import('./openrouter.js');

      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 503,
        code: 'AI_DISABLED',
      });
    });
  });

  describe('payload enviado ao OpenRouter', () => {
    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
    });

    it('monta o payload de chat sem response_format e usa o chat_model configurado', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'meta/chat-free', vision_model: 'meta/vision-free', enabled: true }] });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'Resposta da IA' } }], usage: { total_tokens: 42 } }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      const result = await chatCompletion([{ role: 'user', content: 'Analise este cliente' }]);

      expect(result).toEqual({ content: 'Resposta da IA', tokensUsed: 42, model: 'meta/chat-free' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(init.headers.Authorization).toBe('Bearer sk-or-v1-test-key');

      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('meta/chat-free');
      expect(body.messages).toEqual([{ role: 'user', content: 'Analise este cliente' }]);
      expect(body.response_format).toBeUndefined();
    });

    it('monta o payload de visão com response_format json_object e usa o vision_model configurado', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'meta/chat-free', vision_model: 'qwen/vision-free', enabled: true }] });
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"amount":10}' } }] }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;

      const { visionCompletion } = await import('./openrouter.js');
      await visionCompletion([
        { role: 'user', content: [{ type: 'text', text: 'leia' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] },
      ]);

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('qwen/vision-free');
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('mapeia HTTP 429 da OpenRouter para AI_RATE_LIMIT (429)', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }) as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 429,
        code: 'AI_RATE_LIMIT',
      });
    });

    it('mapeia HTTP 402 da OpenRouter para AI_QUOTA_EXCEEDED (402)', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) }) as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 402,
        code: 'AI_QUOTA_EXCEEDED',
      });
    });

    it('mapeia erro de rede (fetch rejeitando) para AI_CONNECTION_ERROR (502)', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_CONNECTION_ERROR',
      });
    });

    it('mapeia timeout (AbortError) para AI_TIMEOUT (504)', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      global.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 504,
        code: 'AI_TIMEOUT',
      });
    });

    it('lança AI_EMPTY_RESPONSE quando a IA retorna conteúdo vazio', async () => {
      queryMock.mockResolvedValueOnce({ rows: [{ chat_model: 'm', vision_model: 'v', enabled: true }] });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) }) as unknown as typeof fetch;

      const { chatCompletion } = await import('./openrouter.js');
      await expect(chatCompletion([{ role: 'user', content: 'oi' }])).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_EMPTY_RESPONSE',
      });
    });
  });
});
