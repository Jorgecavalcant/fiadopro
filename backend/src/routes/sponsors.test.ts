import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { AddressInfo } from 'net';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'http';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { signToken } from '../utils/jwt.js';

const { queryMock, readPlan } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  readPlan: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  query: queryMock,
  getClient: vi.fn(),
}));

vi.mock('../services/plans.js', () => ({
  readUserPlan: readPlan,
}));

import sponsorRoutes from './sponsors.js';
import adminSponsorRoutes from './adminSponsors.js';
import { resetSponsorLimits } from '../services/sponsorDelivery.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/admin/sponsors', adminSponsorRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

let server: Server;
let baseUrl: string;
const userToken = signToken({ sub: '22222222-2222-2222-2222-222222222222', email: 'teste@example.com' });
const adminToken = signToken({ sub: '11111111-1111-1111-1111-111111111111', email: 'admin@example.com' });

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function json(res: Response): Promise<any> {
  return res.json();
}

function role(name: string | null) {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT role FROM users')) {
      return { rows: name === null ? [] : [{ role: name }] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  queryMock.mockReset();
  readPlan.mockReset();
  resetSponsorLimits();
});

describe('rotas de patrocínio', () => {
  it('responde 401 sem login', async () => {
    const res = await fetch(`${baseUrl}/api/sponsors/slot?slot=faixa`);
    expect(res.status).toBe(401);
  });

  it('responde 403 para quem não é admin', async () => {
    role('user');
    const res = await fetch(`${baseUrl}/api/admin/sponsors`, {
      method: 'POST',
      headers: { Cookie: `fiado_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'TESTE', categoria: 'Mercado', cidade: 'Teste' }),
    });
    expect(res.status).toBe(403);
  });

  it('recusa endereço que não é https público', async () => {
    role('admin');
    const res = await fetch(`${baseUrl}/api/admin/sponsors/contracts/11111111-1111-1111-1111-111111111111/creatives`, {
      method: 'POST',
      headers: { Cookie: `fiado_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'imagem',
        slot: 'faixa',
        media_url: 'http://exemplo.com/a.png',
        link_destino: 'https://exemplo.com',
        titulo: 'TESTE',
        texto_alt: 'Anúncio TESTE',
      }),
    });
    const body = await json(res);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION');
  });

  it('devolve o criativo sem campo interno', async () => {
    role('user');
    readPlan.mockResolvedValue({ plan: 'FREE', confirmed: true });
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users')) return { rows: [{ role: 'user' }] };
      if (sql.includes('FROM sponsor_creatives')) {
        return {
          rows: [
            {
              id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              tipo: 'imagem',
              media_url: 'https://exemplo.com/a.png',
              link_destino: 'https://exemplo.com',
              titulo: 'TESTE',
              texto_alt: 'Anúncio TESTE',
              patrocinador: 'TESTE Mercado',
              ordem: 0,
              exibicoes_hoje: 0,
              valor_centavos: 1500,
              observacao: 'não mostrar',
              documento: '39053344705',
              telefone: '62900000000',
              email: 'teste@exemplo.test',
            },
          ],
        };
      }
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/sponsors/slot?slot=faixa`, {
      headers: { Cookie: `fiado_token=${userToken}` },
    });
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.creative.patrocinador).toBe('TESTE Mercado');
    expect(body.creative).not.toHaveProperty('valor_centavos');
    expect(body.creative).not.toHaveProperty('observacao');
    expect(body.creative).not.toHaveProperty('documento');
    expect(body.creative).not.toHaveProperty('telefone');
    expect(body.creative).not.toHaveProperty('email');
  });

  it('não entrega tela cheia para o Pro', async () => {
    role('user');
    readPlan.mockResolvedValue({ plan: 'PRO', confirmed: true });
    const res = await fetch(`${baseUrl}/api/sponsors/slot?slot=tela_cheia`, {
      headers: { Cookie: `fiado_token=${userToken}` },
    });
    const body = await json(res);
    expect(body.creative).toBeNull();
    const listed = queryMock.mock.calls.some(([sql]) => String(sql).includes('FROM sponsor_creatives'));
    expect(listed).toBe(false);
  });

  it('recusa evento de anúncio fora do ar', async () => {
    role('user');
    readPlan.mockResolvedValue({ plan: 'FREE', confirmed: true });
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM users')) return { rows: [{ role: 'user' }] };
      if (sql.includes('FROM sponsor_creatives')) {
        return {
          rows: [
            {
              slot: 'faixa',
              creative_ativo: true,
              contract_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
              status: 'pausado',
              inicio: '2026-10-01',
              fim: '2026-10-31',
              sponsor_ativo: true,
            },
          ],
        };
      }
      return { rows: [] };
    });
    const res = await fetch(`${baseUrl}/api/sponsors/event`, {
      method: 'POST',
      headers: { Cookie: `fiado_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creative_id: '00000000-0000-4000-8000-000000000001',
        tipo: 'exibicao',
      }),
    });
    expect(res.status).toBe(409);
  });

  it('segura a rajada de eventos', async () => {
    role('user');
    readPlan.mockResolvedValue({ plan: 'ENTERPRISE', confirmed: true });
    let last = 0;
    for (let i = 0; i < 31; i += 1) {
      const res = await fetch(`${baseUrl}/api/sponsors/event`, {
        method: 'POST',
        headers: { Cookie: `fiado_token=${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creative_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          tipo: 'clique',
        }),
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('o evento não devolve e-mail, ip nem id de usuário', async () => {
    role('user');
    readPlan.mockResolvedValue({ plan: 'FREE', confirmed: true });
    const res = await fetch(`${baseUrl}/api/sponsors/event`, {
      method: 'POST',
      headers: { Cookie: `fiado_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creative_id: '00000000-0000-4000-8000-000000000001',
        tipo: 'exibicao',
        email: 'pessoa@exemplo.test',
        user_id: 'nao-guardar',
        ip: '203.0.113.10',
      }),
    });
    const text = await res.text();
    expect(text.includes('@')).toBe(false);
    expect(text).not.toContain('nao-guardar');
    expect(text).not.toContain('203.0.113.10');
    expect(text).not.toContain('user_id');
    expect(text).not.toContain('pessoa');
  });

  it('o relatório não pede dado de usuário', async () => {
    role('admin');
    queryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes('user_id') && String(sql).includes('sponsor_events')) {
        throw new Error('relatorio com usuario');
      }
      if (sql.includes('SELECT role FROM users')) return { rows: [{ role: 'admin' }] };
      if (sql.includes('FROM sponsor_events')) {
        return { rows: [{ slot: 'faixa', plano: 'free', exibicoes: 4, cliques: 1 }] };
      }
      return { rows: [] };
    });
    const res = await fetch(
      `${baseUrl}/api/admin/sponsors/contracts/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/results?from=2026-10-01&to=2026-10-30`,
      { headers: { Cookie: `fiado_token=${adminToken}` } },
    );
    const body = await json(res);
    expect(res.status).toBe(200);
    expect(body.results[0].ctr).toBe(0.25);
    expect(JSON.stringify(body)).not.toContain('user_id');
  });

  it('a lista do marketing não pede contato nem pessoa', async () => {
    const sqls: string[] = [];
    queryMock.mockImplementation(async (sql: string) => {
      sqls.push(String(sql));
      if (String(sql).includes('SELECT role FROM users')) return { rows: [{ role: 'admin' }] };
      return { rows: [] };
    });
    const missing = await fetch(`${baseUrl}/api/admin/sponsors/board`);
    expect(missing.status).toBe(401);
    const res = await fetch(`${baseUrl}/api/admin/sponsors/board`, {
      headers: { Cookie: `fiado_token=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const joined = sqls.join('\n');
    expect(joined).toContain('FROM sponsors');
    expect(joined).not.toMatch(/contato_nome|valor_centavos|user_id/);
    expect(joined).not.toMatch(/\btelefone\b|\bemail\b/);
  });

  it('id que não é UUID não vira erro 500', async () => {
    role('admin');
    const res = await fetch(`${baseUrl}/api/admin/sponsors/contracts/nao-e-uuid`, {
      headers: { Cookie: `fiado_token=${adminToken}` },
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.message).toBe('Identificador inválido.');
  });

  it('a arte pública sai com nosniff e some se o contrato não está no ar', async () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    queryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM sponsor_media')) {
        return {
          rows: [{
            conteudo: Buffer.from('PNG'),
            content_type: 'image/png',
            sha256: 'a'.repeat(64),
            status: 'rascunho',
          }],
        };
      }
      return { rows: [] };
    });
    const hidden = await fetch(`${baseUrl}/api/sponsors/media/${id}`);
    expect(hidden.status).toBe(404);
    queryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT role FROM users')) return { rows: [{ role: 'admin' }] };
      if (String(sql).includes('FROM sponsor_media')) {
        return {
          rows: [{
            conteudo: Buffer.from('PNG'),
            content_type: 'image/png',
            sha256: 'b'.repeat(64),
            status: 'ativo',
          }],
        };
      }
      return { rows: [] };
    });
    const shown = await fetch(`${baseUrl}/api/sponsors/media/${id}`);
    expect(shown.status).toBe(200);
    expect(shown.headers.get('x-content-type-options')).toBe('nosniff');
    expect(shown.headers.get('content-type')).toContain('image/png');
    expect(shown.headers.get('content-disposition')).toContain('inline');
  });
});
