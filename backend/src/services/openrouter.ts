import { query } from '../config/database.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60_000;

export const DEFAULT_CHAT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
export const DEFAULT_VISION_MODEL = 'qwen/qwen-2.5-vl-72b-instruct:free';

export class OpenRouterError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export interface AiConfig {
  chatModel: string;
  visionModel: string;
  enabled: boolean;
}

// Lê a configuração ativa (tabela `ai_config`, migration 005). Nunca lança —
// se a leitura falhar (banco fora do ar, tabela ausente), cai nos defaults
// gratuitos para não derrubar a funcionalidade de IA.
export const getAiConfig = async (): Promise<AiConfig> => {
  try {
    const result = await query(
      'SELECT chat_model, vision_model, enabled FROM ai_config WHERE id = 1',
    );
    const row = result.rows[0];
    if (!row) {
      return { chatModel: DEFAULT_CHAT_MODEL, visionModel: DEFAULT_VISION_MODEL, enabled: true };
    }
    return {
      chatModel: row.chat_model || DEFAULT_CHAT_MODEL,
      visionModel: row.vision_model || DEFAULT_VISION_MODEL,
      enabled: row.enabled !== false,
    };
  } catch (err) {
    console.error(
      '[AI] Falha ao ler ai_config, usando defaults:',
      err instanceof Error ? err.message : err,
    );
    return { chatModel: DEFAULT_CHAT_MODEL, visionModel: DEFAULT_VISION_MODEL, enabled: true };
  }
};

export type ChatMessageContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user';
  content: string | ChatMessageContentPart[];
}

export interface OpenRouterResult {
  content: string;
  tokensUsed: number | null;
  model: string;
}

const callOpenRouter = async (
  model: string,
  messages: ChatMessage[],
  jsonMode: boolean,
): Promise<OpenRouterResult> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Nunca derruba o backend: a IA vira uma feature indisponível, não um crash.
    throw new OpenRouterError(503, 'IA não configurada', 'AI_NOT_CONFIGURED');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: globalThis.Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'https://www.fiadopro.com.br',
        'X-Title': 'Fiado Pro',
      },
      body: JSON.stringify({
        model,
        messages,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OpenRouterError(
        504,
        'IA demorou demais para responder. Tente novamente.',
        'AI_TIMEOUT',
      );
    }
    throw new OpenRouterError(
      502,
      'Não foi possível conectar ao serviço de IA.',
      'AI_CONNECTION_ERROR',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new OpenRouterError(
        429,
        'IA temporariamente sobrecarregada. Tente novamente em instantes.',
        'AI_RATE_LIMIT',
      );
    }
    if (response.status === 402) {
      throw new OpenRouterError(
        402,
        'Cota de IA esgotada no momento. Tente novamente mais tarde.',
        'AI_QUOTA_EXCEEDED',
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new OpenRouterError(503, 'IA não configurada corretamente.', 'AI_AUTH_ERROR');
    }
    throw new OpenRouterError(502, 'Serviço de IA indisponível no momento.', 'AI_UPSTREAM_ERROR');
  }

  interface OpenRouterResponseBody {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  }

  const data = (await response.json().catch(() => null)) as OpenRouterResponseBody | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new OpenRouterError(502, 'IA retornou uma resposta vazia.', 'AI_EMPTY_RESPONSE');
  }
  const tokensUsed = typeof data?.usage?.total_tokens === 'number' ? data.usage.total_tokens : null;

  return { content, tokensUsed, model };
};

export const chatCompletion = async (messages: ChatMessage[]): Promise<OpenRouterResult> => {
  const config = await getAiConfig();
  if (!config.enabled) {
    throw new OpenRouterError(503, 'IA está desativada no momento.', 'AI_DISABLED');
  }
  return callOpenRouter(config.chatModel, messages, false);
};

export const visionCompletion = async (messages: ChatMessage[]): Promise<OpenRouterResult> => {
  const config = await getAiConfig();
  if (!config.enabled) {
    throw new OpenRouterError(503, 'IA está desativada no momento.', 'AI_DISABLED');
  }
  return callOpenRouter(config.visionModel, messages, true);
};
