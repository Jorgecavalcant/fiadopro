import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { assertPublicHttps, cleanOptionalName, cleanText, SponsorRuleError } from '../domain/sponsors.js';
import {
  activateContract,
  cancelContract,
  contractResults,
  createContract,
  createCreative,
  createSponsor,
  listSponsors,
  pauseContract,
  renewContract,
  resumeContract,
  updateSponsor,
} from '../services/sponsorAdmin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD.');

const SponsorBody = z.object({
  nome: z.string(),
  categoria: z.string(),
  cidade: z.string(),
  contato_nome: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

const ContractBody = z.object({
  inicio: dateField,
  fim: dateField,
  planos_alvo: z.array(z.enum(['free', 'pro'])).min(1, 'Escolha Free, Pro ou os dois.'),
  slots: z.array(z.enum(['faixa', 'tela_cheia'])).min(1, 'Escolha o espaço do anúncio.'),
  valor_centavos: z.number().int().min(0).nullable().optional(),
  observacao: z.string().max(280, 'A observação passa de 280 caracteres.').nullable().optional(),
});

const CreativeBody = z.object({
  tipo: z.enum(['imagem', 'video'], { message: 'O criativo é imagem ou vídeo.' }),
  slot: z.enum(['faixa', 'tela_cheia']),
  media_url: z.string(),
  link_destino: z.string(),
  titulo: z.string(),
  texto_alt: z.string(),
  ordem: z.number().int().min(0).max(999).optional(),
});

function readInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message || 'Dados inválidos.', 'VALIDATION');
  }
  return parsed.data;
}

function asRule(error: unknown): never {
  if (error instanceof SponsorRuleError) {
    throw new ApiError(400, error.message, 'VALIDATION');
  }
  throw error;
}

function pass(error: unknown, next: NextFunction) {
  if (error instanceof SponsorRuleError) {
    next(new ApiError(400, error.message, 'VALIDATION'));
    return;
  }
  next(error);
}

function sponsorInput(body: z.infer<typeof SponsorBody>, ativo = true) {
  try {
    return {
      nome: cleanText(body.nome, 80, 'o nome'),
      categoria: cleanText(body.categoria, 40, 'a categoria'),
      cidade: cleanText(body.cidade, 80, 'a cidade'),
      contato_nome: cleanOptionalName(body.contato_nome),
      ativo,
    };
  } catch (error) {
    asRule(error);
  }
}

function contractInput(body: z.infer<typeof ContractBody>) {
  if (body.fim < body.inicio) {
    throw new ApiError(400, 'A data final não pode ser antes do início.', 'VALIDATION');
  }
  return {
    inicio: body.inicio,
    fim: body.fim,
    planos_alvo: body.planos_alvo,
    slots: body.slots,
    valor_centavos: body.valor_centavos ?? null,
    observacao: body.observacao?.trim() ? cleanText(body.observacao, 280, 'a observação') : null,
  };
}

function httpsFields(media: string, destino: string) {
  try {
    return { media_url: assertPublicHttps(media), link_destino: assertPublicHttps(destino) };
  } catch (error) {
    asRule(error);
  }
}

router.get('/', async (_req, res, next) => {
  try {
    res.json({ sponsors: await listSponsors() });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(SponsorBody, req.body);
    const sponsor = await createSponsor(req.user!.sub, sponsorInput(body));
    res.status(201).json({ sponsor });
  } catch (error) {
    pass(error, next);
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(SponsorBody, req.body);
    const sponsor = await updateSponsor(
      req.user!.sub,
      req.params.id,
      sponsorInput(body, body.ativo ?? true),
    );
    res.json({ sponsor });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/:id/contracts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(ContractBody, req.body);
    const contract = await createContract(req.user!.sub, req.params.id, contractInput(body));
    res.status(201).json({ contract });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/pause', async (req: AuthRequest, res, next) => {
  try {
    res.json({ contract: await pauseContract(req.user!.sub, req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/resume', async (req: AuthRequest, res, next) => {
  try {
    res.json({ contract: await resumeContract(req.user!.sub, req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    res.json({ contract: await cancelContract(req.user!.sub, req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    res.json({ contract: await activateContract(req.user!.sub, req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/renew', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(ContractBody, req.body);
    const contract = await renewContract(req.user!.sub, req.params.id, contractInput(body));
    res.status(201).json({ contract });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/creatives', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(CreativeBody, req.body);
    const urls = httpsFields(body.media_url, body.link_destino);
    const creative = await createCreative(req.user!.sub, req.params.id, {
      tipo: body.tipo,
      slot: body.slot,
      media_url: urls.media_url,
      link_destino: urls.link_destino,
      titulo: cleanText(body.titulo, 80, 'o título'),
      texto_alt: cleanText(body.texto_alt, 160, 'o texto alternativo'),
      ordem: body.ordem ?? 0,
    });
    res.status(201).json({ creative });
  } catch (error) {
    pass(error, next);
  }
});

router.get('/contracts/:id/results', async (req, res, next) => {
  try {
    const query = readInput(
      z.object({ from: dateField, to: dateField }),
      req.query,
    );
    if (query.to < query.from) {
      throw new ApiError(400, 'A data final não pode ser antes do início.', 'VALIDATION');
    }
    const results = await contractResults(req.params.id, query.from, query.to);
    res.json({ results });
  } catch (error) {
    pass(error, next);
  }
});

export default router;
