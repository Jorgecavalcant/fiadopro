import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendMessage } from '../config/gemini.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Validation schema
const GeminiRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  context: z.object({
    debts: z.array(z.any()).optional(),
    userId: z.string().optional(),
  }).optional(),
});

// POST /api/gemini/chat
router.post(
  '/chat',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = GeminiRequestSchema.parse(req.body);
      const { prompt, context } = body;

      // Build prompt with context if provided
      let finalPrompt = prompt;
      if (context?.debts && context.debts.length > 0) {
        const debtsSummary = context.debts
          .map(
            (d: any) =>
              `- ${d.name}: R$ ${d.amount.toFixed(2)} (${d.daysOverdue || 0} dias)`
          )
          .join('\n');

        finalPrompt = `Você é um assistente especializado em gestão de crédito pessoal.
Aqui estão as dívidas do usuário:
${debtsSummary}

Pergunta do usuário: ${prompt}

Forneça uma resposta útil e prática em português.`;
      }

      // Call Gemini API (secure on server-side)
      const response = await sendMessage(finalPrompt);

      res.json({
        success: true,
        response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(
          new ApiError(
            400,
            'Invalid request body',
            'VALIDATION_ERROR'
          )
        );
      }

      if (error instanceof Error && error.message.includes('API')) {
        return next(
          new ApiError(
            502,
            'Gemini API error',
            'GEMINI_ERROR'
          )
        );
      }

      next(error);
    }
  }
);

export default router;
