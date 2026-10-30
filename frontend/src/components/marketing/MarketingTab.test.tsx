/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from '../AdminPanel';
import { MarketingContract } from './MarketingContract';
import { MarketingOverview } from './MarketingOverview';
import { MarketingResults } from './MarketingResults';
import { SponsorStrip } from './SponsorCreative';
import { contactProblem, linkProblem } from './sponsorLink';
import { adminPanelFor } from '../../utils/adminAccess';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function ok(body: unknown) {
  return { ok: true, json: async () => body, blob: async () => new Blob(['pdf']) };
}

describe('marketing no admin', () => {
  it('a aba só existe para admin e aparece entre Concessões e Registro', async () => {
    expect(adminPanelFor('admin')).toBe(true);
    expect(adminPanelFor('user')).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => ok({ success: true, users: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    await act(async () => {
      root.render(<AdminPanel />);
    });
    const labels = [...document.querySelectorAll('.fp-admin-tab')].map((item) => item.textContent);
    expect(labels).toEqual(['Usuários', 'Visão geral', 'Concessões', 'Marketing', 'Registro', 'Contas encerradas']);
    expect(document.body.textContent).toContain('Painel administrativo');
    act(() => root.unmount());
  });

  it('mostra o vazio e o erro da visão geral', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/summary')) {
        return ok({
          summary: {
            patrocinadores_ativos: 0,
            patrocinadores_total: 0,
            vencendo_7: 0,
            mes_nome: 'outubro',
            exibicoes: 0,
            cliques: 0,
            ctr: 0,
            mes_anterior_nome: 'setembro',
            ctr_anterior: null,
          },
        });
      }
      return ok({ rows: [] });
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MarketingOverview onOpen={() => undefined} onCreate={() => undefined} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.body.textContent).toContain('Nenhum patrocinador ainda. Cadastre o primeiro.');
    act(() => root.unmount());

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: { message: 'Falhou agora.' } }) })));
    const host2 = document.createElement('div');
    document.body.appendChild(host2);
    const root2 = createRoot(host2);
    await act(async () => {
      root2.render(<MarketingOverview onOpen={() => undefined} onCreate={() => undefined} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.body.textContent).toContain('Falhou agora.');
    act(() => root2.unmount());
  });

  it('valida contato e link, mostra a arte e deixa Enterprise desativado', async () => {
    expect(contactProblem('ana@exemplo.com')).toMatch(/só o nome/);
    expect(linkProblem('http://exemplo.com')).toMatch(/https/);
    expect(linkProblem('javascript:alert(1)')).toBeTruthy();
    expect(linkProblem('https://fcbarcelona.com/a')).toBeNull();
    expect(linkProblem('https://wa.me/5500000000000')).toBeNull();

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <SponsorStrip
          tipo="imagem"
          mediaUrl="https://exemplo.test/arte.jpg"
          alt="Pães na vitrine"
          href="https://wa.me/5500000000000"
        />,
      );
    });
    const image = document.querySelector('img');
    const link = document.querySelector('a.fp-sponsor-cta');
    expect(image?.getAttribute('src')).toBe('https://exemplo.test/arte.jpg');
    expect(document.body.textContent).toContain('Patrocinado');
    expect(link?.textContent).toBe('Saiba mais');
    expect(link?.getAttribute('href')).toBe('https://wa.me/5500000000000');
    expect(link?.getAttribute('rel')).toContain('noopener');
    act(() => root.unmount());

    vi.stubGlobal('fetch', vi.fn(async () => ok({ sponsors: [] })));
    const form = document.createElement('div');
    document.body.appendChild(form);
    const formRoot = createRoot(form);
    await act(async () => {
      formRoot.render(<MarketingContract sponsorId="00000000-0000-4000-8000-000000000001" contractId={null} onOpenContract={() => undefined} />);
    });
    const enterprise = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('sem anúncios'));
    expect(enterprise).toBeTruthy();
    expect((enterprise as HTMLButtonElement).disabled).toBe(true);
    act(() => formRoot.unmount());
  });

  it('o relatório na tela não mostra dado pessoal', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const target = String(url);
      if (target.includes('/board')) {
        return ok({ rows: [{ sponsor_id: 's', nome: 'TESTE Padaria', categoria: 'Padaria', cidade: 'Recife', ativo: true, contract_id: 'c', inicio: '2026-10-01', fim: '2026-10-31', planos_alvo: ['free'], slots: ['faixa'], status: 'ativo' }] });
      }
      if (target.includes('/daily')) return ok({ days: [{ dia: '2026-10-30', exibicoes: 4, cliques: 1 }] });
      if (target.includes('/results')) return ok({ results: [{ slot: 'faixa', plano: 'free', exibicoes: 4, cliques: 1, ctr: 0.25 }] });
      return ok({});
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MarketingResults />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const text = document.body.textContent || '';
    expect(text).toContain('Só contagens. Nenhum dado de cliente entra no relatório.');
    expect(text).toContain('Baixar PDF');
    expect(text).not.toMatch(/@|cpf|pix|telefone/i);
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Baixar PDF'));
    await act(async () => {
      button?.click();
    });
    const calls = (fetch as unknown as { mock: { calls: string[][] } }).mock.calls.map((call) => String(call[0]));
    expect(calls.some((url) => url.includes('report.pdf'))).toBe(true);
    act(() => root.unmount());
  });
});
