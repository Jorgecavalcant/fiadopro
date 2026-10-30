import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { nextCreative, recordEvent } from '../services/sponsorDelivery.js';
import { sendSponsorMedia } from '../services/sponsorMedia.js';

const router = Router();

router.get('/media/:id', async (req: AuthRequest, res, next) => {
  try {
    await sendSponsorMedia(req, res);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

const SlotQuery = z.object({
  slot: z.enum(['faixa', 'tela_cheia'], { message: 'O espaço deve ser faixa ou tela cheia.' }),
});

const EventBody = z.object({
  creative_id: z.string().uuid('Informe o anúncio.'),
  tipo: z.enum(['exibicao', 'clique'], { message: 'O tipo deve ser exibição ou clique.' }),
});

function readInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message || 'Dados inválidos.', 'VALIDATION');
  }
  return parsed.data;
}

router.get('/slot', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slot } = readInput(SlotQuery, req.query);
    const creative = await nextCreative(req.user!.sub, slot);
    res.json({ creative });
  } catch (error) {
    next(error);
  }
});

router.post('/event', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(EventBody, req.body);
    const result = await recordEvent(req.user!.sub, body.creative_id, body.tipo);
    res.json({ success: true, counted: result.counted });
  } catch (error) {
    next(error);
  }
});

export default router;
