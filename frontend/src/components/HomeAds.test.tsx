/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePanel } from './HomePanel';
import { resetSponsorSession, skipFullscreenThisSession } from './HomeAds';

let root: Root | undefined;

const strip = {
  id: '00000000-0000-4000-8000-000000000010',
  tipo: 'imagem',
  media_url: '/api/sponsors/media/00000000-0000-4000-8000-000000000011',
  link_destino: 'https://exemplo.test/teste',
  titulo: 'Pão quentinho às 17h',
  texto_alt: 'Pão na vitrine',
  patrocinador: 'TESTE Padaria',
  email: 'pessoa@exemplo.test',
};

const full = {
  ...strip,
  id: '00000000-0000-4000-8000-000000000012',
  titulo: 'Pão quentinho todo dia às 17h',
  texto_alt: 'Passe aqui na volta pra casa.',
};

function ok(body: unknown) {
  return { ok: true, json: async () => body };
}

function adsFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const text = String(url);
    if (text.includes('tela_cheia')) return ok({ creative: full });
    if (text.includes('slot=faixa')) return ok({ creative: strip });
    if (text.includes('/event')) return ok({ success: true, counted: true, echo: init?.body });
    return ok({ creative: null });
  });
}

class SeenObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [0.5];
}

function panel(extra: Record<string, unknown> = {}) {
  return (
    <HomePanel
      userName="TESTE Ana"
      formatCurrency={(value: number) => `R$ ${value.toFixed(2)}`}
      receivable={10}
      payable={0}
      overdue={0}
      activeDebtors={1}
      attention={[
        { customerId: 'a', name: 'TESTE Ana', kind: 'overdue', reason: 'Venceu há 5 dias', amount: 10 },
      ]}
      onNewDebt={() => undefined}
      onReceive={() => undefined}
      onSplit={() => undefined}
      onNewCustomer={() => undefined}
      {...extra}
    />
  );
}

async function show(node: React.ReactNode) {
  root?.unmount();
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(node);
  });
}

function events(fetchMock: ReturnType<typeof adsFetch>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes('/sponsors/event'))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { creative_id: string; tipo: string });
}

beforeEach(() => {
  resetSponsorSession();
  sessionStorage.clear();
  vi.stubGlobal('IntersectionObserver', SeenObserver);
});

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('patrocínio no início', () => {
  it('o Free mostra a faixa A e a tela cheia uma vez', async () => {
    const fetchMock = adsFetch();
    vi.stubGlobal('fetch', fetchMock);
    await show(panel({ adPlan: 'free' }));
    expect(document.body.textContent).toContain('Precisa da sua atenção');
    expect(document.body.textContent).toContain('Pão quentinho às 17h');
    expect(document.body.textContent).toContain('TESTE Padaria');
    expect(document.body.textContent).toContain('Patrocinado');
    expect(document.body.textContent).not.toContain('pessoa@exemplo.test');
    const image = document.querySelector('.fp-sponsor-strip img');
    expect(image?.getAttribute('alt')).toBe('Pão na vitrine');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('width')).toBe('358');
    expect(image?.getAttribute('height')).toBe('92');
    const link = document.querySelector('.fp-sponsor-strip a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('rel')).toContain('noreferrer');
    expect(document.querySelector('[aria-label="Fechar anúncio"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Você verá isso no máximo 1 vez por período');
    const seen = events(fetchMock).filter((item) => item.tipo === 'exibicao' && item.creative_id === strip.id);
    expect(seen).toHaveLength(1);
    const open = events(fetchMock).filter((item) => item.tipo === 'exibicao' && item.creative_id === full.id);
    expect(open).toHaveLength(1);
    await act(async () => {
      (link as HTMLAnchorElement).click();
      (link as HTMLAnchorElement).click();
    });
    const clicks = events(fetchMock).filter((item) => item.tipo === 'clique' && item.creative_id === strip.id);
    expect(clicks).toHaveLength(1);
    for (const item of events(fetchMock)) {
      expect(Object.keys(item).sort()).toEqual(['creative_id', 'tipo']);
    }
    expect(JSON.stringify(events(fetchMock))).not.toContain('pessoa@exemplo.test');
  });

  it('o X e o Esc fecham a tela cheia', async () => {
    vi.stubGlobal('fetch', adsFetch());
    await show(panel({ adPlan: 'free' }));
    const close = document.querySelector('[aria-label="Fechar anúncio"]') as HTMLButtonElement;
    await act(async () => {
      close.click();
    });
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();

    resetSponsorSession();
    sessionStorage.clear();
    await show(panel({ adPlan: 'free' }));
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();
  });

  it('não abre a tela cheia na sessão do login nem por cima de um fluxo', async () => {
    const fetchMock = adsFetch();
    vi.stubGlobal('fetch', fetchMock);
    skipFullscreenThisSession();
    await show(panel({ adPlan: 'free' }));
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('tela_cheia'))).toBe(false);

    sessionStorage.clear();
    resetSponsorSession();
    const blocked = adsFetch();
    vi.stubGlobal('fetch', blocked);
    await show(panel({ adPlan: 'free', flowOpen: true }));
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();
    expect(blocked.mock.calls.some(([url]) => String(url).includes('tela_cheia'))).toBe(false);
    await act(async () => {
      root?.render(panel({ adPlan: 'free', flowOpen: false }));
    });
    expect(document.querySelector('[aria-label="Fechar anúncio"]')).not.toBeNull();
  });

  it('o Pro mostra só a faixa discreta', async () => {
    const fetchMock = adsFetch();
    vi.stubGlobal('fetch', fetchMock);
    await show(panel({ adPlan: 'pro', isPro: true }));
    expect(document.body.textContent).toContain('PATROCINADO');
    expect(document.body.textContent).toContain('TESTE Padaria · Pão quentinho às 17h');
    expect(document.querySelector('.fp-sponsor-strip img')).toBeNull();
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('tela_cheia'))).toBe(false);
    const link = document.querySelector('.fp-sponsor-quiet a');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('Enterprise e admin não mostram anúncio', async () => {
    const enterprise = adsFetch();
    vi.stubGlobal('fetch', enterprise);
    await show(panel({ adPlan: 'enterprise' }));
    expect(document.body.textContent).not.toContain('Patrocinado');
    expect(document.body.textContent).not.toContain('PATROCINADO');
    expect(document.querySelector('.fp-sponsor-slot')).toBeNull();
    expect(enterprise).not.toHaveBeenCalled();

    const admin = adsFetch();
    vi.stubGlobal('fetch', admin);
    await show(panel({ adPlan: 'admin' }));
    expect(document.querySelector('.fp-sponsor-slot')).toBeNull();
    expect(admin).not.toHaveBeenCalled();
  });

  it('sem anúncio, erro de busca ou imagem quebrada não mostra nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ creative: null })));
    await show(panel({ adPlan: 'free' }));
    expect(document.querySelector('.fp-sponsor-slot')).toBeNull();
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('rede');
    }));
    await show(panel({ adPlan: 'free' }));
    expect(document.body.textContent).not.toContain('Patrocinado');
    expect(document.body.textContent).not.toContain('rede');

    vi.stubGlobal('fetch', adsFetch());
    await show(panel({ adPlan: 'free' }));
    await act(async () => {
      document.querySelectorAll('img').forEach((img) => img.dispatchEvent(new Event('error')));
    });
    expect(document.querySelector('.fp-sponsor-strip')).toBeNull();
    expect(document.querySelector('.fp-sponsor-overlay')).toBeNull();
    expect(document.body.textContent).not.toContain('Não consegui carregar');
  });
});
