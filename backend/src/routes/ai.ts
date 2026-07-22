import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { createLimiter } from '../middleware/rateLimiter.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  chatCompletion,
  visionCompletion,
  getAiConfig,
  OpenRouterError,
  ChatMessage,
} from '../services/openrouter.js';

export const MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const estimateBase64Bytes = (base64: string): number => {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  return Math.floor((clean.length * 3) / 4);
};

// Registra a interação na tabela `ai_interactions` (já existe no schema base,
// ver db-init.sql). Nunca lança — falha de auditoria não pode derrubar a rota.
const logInteraction = async (
  userId: string,
  prompt: string,
  response: string,
  tokensUsed: number | null
): Promise<void> => {
  try {
    await query(
      'INSERT INTO ai_interactions (user_id, prompt, response, tokens_used) VALUES ($1, $2, $3, $4)',
      [userId, prompt.slice(0, 8000), response.slice(0, 8000), tokensUsed]
    );
  } catch (err) {
    console.error('[AI] Falha ao gravar ai_interactions:', err instanceof Error ? err.message : err);
  }
};

const mapError = (err: unknown, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return next(new ApiError(400, err.errors[0]?.message || 'Requisição inválida', 'VALIDATION_ERROR'));
  }
  if (err instanceof OpenRouterError) {
    return next(new ApiError(err.statusCode, err.message, err.code));
  }
  next(err);
};

// ===== /api/ai/* (requireAuth + rate limit por usuário) =====

const router = Router();

const aiRateLimiter = createLimiter(20, 60 * 1000, (req) => (req as AuthRequest).user?.sub || req.ip || 'unknown');

router.use(requireAuth);
router.use(aiRateLimiter);

export const AnalyzeCustomerSchema = z.object({
  customer: z
    .object({
      name: z.string().min(1).max(255),
      balance: z.number().optional(),
      rawBalance: z.number().optional(),
    })
    .nullable()
    .optional(),
  transactions: z
    .array(
      z.object({
        type: z.string(),
        amount: z.number(),
        description: z.string().optional(),
        timestamp: z.number().optional(),
      })
    )
    .default([]),
  language: z.enum(['pt-BR', 'en']).default('pt-BR'),
  // Divergência documentada da SPEC (registrada no PR): a SPEC descreve
  // analyze-customer só para análise de UM cliente, mas o frontend também
  // tinha `getGeneralBusinessAdvice` (dicas gerais de fluxo de caixa) chamando
  // Gemini direto. Para não deixar esse caminho fora do backend, o mesmo
  // endpoint aceita `mode: 'business'` + `stats` em vez de `customer`.
  mode: z.enum(['customer', 'business']).default('customer'),
  stats: z
    .object({
      totalReceivable: z.number(),
      activeCustomers: z.number(),
    })
    .optional(),
});

// POST /api/ai/analyze-customer
router.post('/analyze-customer', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = AnalyzeCustomerSchema.parse(req.body);
    const langInstruction = body.language === 'pt-BR' ? 'Responda em Português do Brasil.' : 'Respond in English.';

    let prompt: string;
    if (body.mode === 'business' || !body.customer) {
      if (!body.stats) {
        return next(new ApiError(400, 'stats é obrigatório para mode=business', 'VALIDATION_ERROR'));
      }
      prompt = `Sou dono de um pequeno negócio que usa fiado (crédito informal) com clientes.
Atualmente tenho R$ ${body.stats.totalReceivable.toFixed(2)} a receber, com ${body.stats.activeCustomers} clientes ativos.

Dê 3 dicas rápidas e práticas para melhorar meu fluxo de caixa e reduzir a inadimplência.
${langInstruction}`;
    } else {
      const history = body.transactions
        .map(
          (t) =>
            `${t.timestamp ? new Date(t.timestamp).toLocaleDateString() : '(sem data)'}: ${t.type} de R$ ${t.amount.toFixed(2)} - ${t.description || ''}`
        )
        .join('\n');

      prompt = `Analise o histórico de crédito do cliente "${body.customer.name}".
Saldo atual: R$ ${(body.customer.balance ?? 0).toFixed(2)}
Histórico:
${history || '(sem transações)'}

Com base nesses dados, forneça:
1. Uma avaliação de risco (Baixo, Médio, Alto).
2. Uma sugestão de como cobrar, caso ele esteja devendo.
3. Um resumo do comportamento de pagamento.

Mantenha o tom profissional e útil para um pequeno empresário.
${langInstruction}`;
    }

    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    try {
      const { content, tokensUsed } = await chatCompletion(messages);
      await logInteraction(req.user!.sub, prompt, content, tokensUsed);
      res.json({ success: true, analysis: content });
    } catch (err) {
      if (err instanceof OpenRouterError) {
        await logInteraction(req.user!.sub, prompt, `[ERRO ${err.code}] ${err.message}`, null);
      }
      throw err;
    }
  } catch (err) {
    mapError(err, next);
  }
});

export const ReadDocumentSchema = z
  .object({
    image: z.object({
      data: z.string().min(1),
      mimeType: z.enum(MIME_ALLOWLIST),
    }),
    hint: z.string().max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (estimateBase64Bytes(val.image.data) > MAX_IMAGE_BYTES) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Arquivo maior que 10MB', path: ['image', 'data'] });
    }
  });

const ReadDocumentResultSchema = z.object({
  amount: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  items: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
});

// POST /api/ai/read-document
router.post('/read-document', async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Descrição curta para auditoria — nunca logamos o base64 da imagem/documento.
  const auditPrompt = `[read-document] mime=${req.body?.image?.mimeType || '?'} hint=${req.body?.hint || ''}`.slice(
    0,
    8000
  );

  try {
    const body = ReadDocumentSchema.parse(req.body);

    const dataUri = `data:${body.image.mimeType};base64,${body.image.data}`;
    const prompt = `Você é um assistente de OCR especializado em recibos e notas fiscais brasileiras (NFC-e).
Extraia os dados do documento/imagem fornecido e responda ESTRITAMENTE em JSON, no formato:
{"amount": number|null, "description": string|null, "date": "YYYY-MM-DD"|null, "customerName": string|null, "items": [{"name": string, "price": number}]}

Regras:
- "amount" = valor total do documento (ou valor a pagar), se identificável.
- "description" = breve descrição do que foi comprado/do documento.
- "date" = data do documento no formato YYYY-MM-DD, se visível.
- "customerName" = nome do cliente/comprador, se aparecer no documento.
- "items" = lista de itens individuais com nome e preço. NUNCA inclua "TOTAL", "SUBTOTAL" ou impostos (ICMS, ISS etc.) como item.
- Se um campo não puder ser identificado, retorne null (ou lista vazia para items).
${body.hint ? `Contexto adicional: ${body.hint}` : ''}
Retorne APENAS o JSON, sem nenhum texto adicional.`;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ];

    try {
      const { content, tokensUsed } = await visionCompletion(messages);

      let parsedJson: unknown;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        throw new OpenRouterError(502, 'IA não conseguiu interpretar o documento.', 'AI_PARSE_ERROR');
      }

      const result = ReadDocumentResultSchema.parse(parsedJson);
      await logInteraction(req.user!.sub, auditPrompt, JSON.stringify(result), tokensUsed);
      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof OpenRouterError) {
        await logInteraction(req.user!.sub, auditPrompt, `[ERRO ${err.code}] ${err.message}`, null);
      }
      throw err;
    }
  } catch (err) {
    mapError(err, next);
  }
});

export default router;

// ===== /api/admin/ai-config (requireAuth + requireAdmin) =====
// Mesmo arquivo (mission da frente IA cobre este endpoint); mas o path
// (/api/admin/*) é distinto de /api/ai/*, então exportamos um router à parte
// para ser montado em `/api/admin` no server.ts.

export const adminAiConfigRouter = Router();

adminAiConfigRouter.use(requireAuth, requireAdmin);

const AiConfigUpdateSchema = z.object({
  chatModel: z.string().min(1).max(200).optional(),
  visionModel: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
});

// GET /api/admin/ai-config
adminAiConfigRouter.get('/ai-config', async (_req, res, next) => {
  try {
    const config = await getAiConfig();
    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/ai-config
adminAiConfigRouter.put('/ai-config', async (req, res, next) => {
  try {
    const body = AiConfigUpdateSchema.parse(req.body);
    const columnMap: Record<string, string> = {
      chatModel: 'chat_model',
      visionModel: 'vision_model',
      enabled: 'enabled',
    };
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) {
      return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));
    }

    const setClause = fields.map(([k], i) => `${columnMap[k]} = $${i + 1}`).join(', ');
    const values = fields.map(([, v]) => v);

    const result = await query(
      `UPDATE ai_config SET ${setClause}, updated_at = NOW() WHERE id = 1 RETURNING *`,
      values
    );
    res.json({ success: true, config: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new ApiError(400, err.errors[0]?.message || 'Requisição inválida', 'VALIDATION_ERROR'));
    }
    next(err);
  }
});
