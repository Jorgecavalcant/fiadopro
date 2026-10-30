import express, { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { assertPublicHttps, cleanOptionalName, cleanText, SponsorRuleError } from '../domain/sponsors.js';
import {
  activateContract,
  cancelContract,
  contractResults,
  createContract,
  updateContractDraft,
  createCreative,
  createSponsor,
  listSponsors,
  pauseContract,
  renewContract,
  resumeContract,
  updateCreative,
  updateSponsor,
} from '../services/sponsorAdmin.js';
import { contractDaily, contractDetail, contractReport, sponsorBoard, sponsorSummary } from '../services/sponsorReads.js';
import { renderSponsorPdf } from '../services/sponsorReportPdf.js';
import { ImageRuleError, readMultipartFile } from '../domain/sponsorImage.js';
import { contractPdf, documentPreview, issueContractDocument } from '../services/sponsorContractDoc.js';
import { storeSponsorMedia } from '../services/sponsorMedia.js';
import { loadSponsor, readProfile, saveSponsorProfile } from '../services/sponsorProfile.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.param('id', (_req, _res, next, value) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) {
    next(new ApiError(400, 'Identificador inválido.', 'VALIDATION'));
    return;
  }
  next();
});

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD.');

const SponsorBody = z.object({
  nome: z.string(),
  categoria: z.string(),
  cidade: z.string(),
  contato_nome: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  tipo_pessoa: z.enum(['pj', 'pf']).optional(),
  razao_social: z.string().nullable().optional(),
  documento: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  uf: z.string().nullable().optional(),
  representante_nome: z.string().nullable().optional(),
  representante_cargo: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

const ContractBody = z.object({
  inicio: dateField,
  fim: dateField,
  planos_alvo: z.array(z.enum(['free', 'pro'])).min(1, 'Escolha Free, Pro ou os dois.'),
  slots: z.array(z.enum(['faixa', 'tela_cheia'])).min(1, 'Escolha o espaço do anúncio.'),
  valor_centavos: z.number().int().min(0).nullable().optional(),
  observacao: z.string().max(280, 'A observação passa de 280 caracteres.').nullable().optional(),
  forma_pagamento: z.enum(['pix', 'boleto', 'transferencia']).nullable().optional(),
  parcelas: z.number().int().min(1).max(36).nullable().optional(),
  dia_vencimento: z.number().int().min(1).max(28).nullable().optional(),
  aviso_previo_dias: z.number().int().min(1).max(90).nullable().optional(),
});

const CreativeBody = z.object({
  tipo: z.enum(['imagem', 'video'], { message: 'O criativo é imagem ou vídeo.' }),
  slot: z.enum(['faixa', 'tela_cheia']),
  media_url: z.string(),
  link_destino: z.string(),
  titulo: z.string(),
  texto_alt: z.string(),
  ordem: z.number().int().min(0).max(999).optional(),
  zoom: z.number().min(1).max(3).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
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
  if (error instanceof SponsorRuleError || error instanceof ImageRuleError) {
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
    forma_pagamento: body.forma_pagamento ?? null,
    parcelas: body.parcelas ?? null,
    dia_vencimento: body.dia_vencimento ?? null,
    aviso_previo_dias: body.aviso_previo_dias ?? 15,
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
    if (body.tipo_pessoa) {
      await saveSponsorProfile(req.user!.sub, String(sponsor.id), readProfile(body));
    }
    res.status(201).json({ sponsor: { ...sponsor, id: sponsor.id } });
  } catch (error) {
    pass(error, next);
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(SponsorBody, req.body);
    if (body.tipo_pessoa) {
      await saveSponsorProfile(req.user!.sub, req.params.id, readProfile(body));
    } else {
      await updateSponsor(req.user!.sub, req.params.id, sponsorInput(body, body.ativo ?? true));
    }
    res.json({ sponsor: { id: req.params.id } });
  } catch (error) {
    pass(error, next);
  }
});

router.patch('/contracts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(ContractBody, req.body);
    const contract = await updateContractDraft(req.user!.sub, req.params.id, contractInput(body));
    res.json({ contract });
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
      zoom: body.zoom,
      x: body.x,
      y: body.y,
    });
    res.status(201).json({ creative });
  } catch (error) {
    pass(error, next);
  }
});

function periodOf(value: unknown) {
  const query = readInput(z.object({ from: dateField, to: dateField }), value);
  if (query.to < query.from) {
    throw new ApiError(400, 'A data final não pode ser antes do início.', 'VALIDATION');
  }
  const [fromYear, fromMonth, fromDay] = query.from.split('-').map(Number);
  const [toYear, toMonth, toDay] = query.to.split('-').map(Number);
  const span = (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000;
  if (span > 366) throw new ApiError(400, 'Escolha no máximo um ano.', 'VALIDATION');
  return query;
}

router.get('/board', async (_req, res, next) => {
  try {
    res.json({ rows: await sponsorBoard() });
  } catch (error) {
    pass(error, next);
  }
});

router.get('/summary', async (_req, res, next) => {
  try {
    res.json({ summary: await sponsorSummary() });
  } catch (error) {
    pass(error, next);
  }
});

router.get('/contracts/:id/daily', async (req, res, next) => {
  try {
    const query = periodOf(req.query);
    res.json({ days: await contractDaily(req.params.id, query.from, query.to) });
  } catch (error) {
    pass(error, next);
  }
});

router.get('/contracts/:id/report.pdf', async (req, res, next) => {
  try {
    const query = periodOf(req.query);
    const report = await contractReport(req.params.id, query.from, query.to);
    const pdf = await renderSponsorPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados.pdf"');
    res.send(pdf);
  } catch (error) {
    pass(error, next);
  }
});

router.get('/contracts/:id', async (req, res, next) => {
  try {
    res.json({ contract: await contractDetail(req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.patch('/creatives/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = readInput(CreativeBody, req.body);
    const urls = httpsFields(body.media_url, body.link_destino);
    const creative = await updateCreative(req.user!.sub, req.params.id, {
      tipo: body.tipo,
      slot: body.slot,
      media_url: urls.media_url,
      link_destino: urls.link_destino,
      titulo: cleanText(body.titulo, 80, 'o título'),
      texto_alt: cleanText(body.texto_alt, 160, 'o texto alternativo'),
      zoom: body.zoom,
      x: body.x,
      y: body.y,
    });
    res.json({ creative });
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

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ sponsor: await loadSponsor(req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post(
  '/contracts/:id/media',
  (req, res, next) => {
    express.raw({ type: 'multipart/form-data', limit: '2mb' })(req, res, (error) => {
      if (error) {
        next(new ApiError(400, 'A imagem passa de 2 MB.', 'VALIDATION'));
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = readMultipartFile(req.body as Buffer, String(req.headers['content-type'] || ''));
      const saved = await storeSponsorMedia(req.params.id, parsed.file, parsed.fields);
      res.status(201).json({ creative: saved });
    } catch (error) {
      pass(error, next);
    }
  },
);

router.get('/contracts/:id/document', async (req, res, next) => {
  try {
    res.json({ document: await documentPreview(req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.post('/contracts/:id/document', async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json({ document: await issueContractDocument(req.user!.sub, req.params.id) });
  } catch (error) {
    pass(error, next);
  }
});

router.get('/contracts/:id/contract.pdf', async (req, res, next) => {
  try {
    const file = await contractPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.pdf);
  } catch (error) {
    pass(error, next);
  }
});

export default router;
