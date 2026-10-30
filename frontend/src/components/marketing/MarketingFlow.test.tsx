/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtStep } from './ArtStep';
import { MarketingFlow } from './MarketingFlow';
import { ReviewStep } from './ReviewStep';
import { SponsorStep } from './SponsorStep';
import { cnpjProblem, cpfProblem, emailProblem, pageLinkProblem, phoneProblem } from './party';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function ok(body: unknown) {
  return { ok: true, json: async () => body };
}

function fill(label: string, value: string) {
  const input = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('fluxo do patrocínio', () => {
  it('valida documento, telefone e e-mail e avisa link de página', () => {
    expect(cpfProblem('390.533.447-05')).toBeNull();
    expect(cpfProblem('111.111.111-11')).toMatch(/CPF/);
    expect(cnpjProblem('11.222.333/0001-81')).toBeNull();
    expect(phoneProblem('')).toMatch(/telefone/);
    expect(emailProblem('')).toMatch(/e-mail/);
    expect(pageLinkProblem('https://www.instagram.com/p/teste')).toMatch(/página/);
    expect(pageLinkProblem('https://exemplo.test/arte.jpg')).toBeNull();
  });

  it('foca o primeiro erro e não segue sem telefone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ sponsor: { id: 's1' } })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<SponsorStep sponsorId={null} saving={false} onSaving={() => undefined} onSaved={() => undefined} />);
    });
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Salvar'));
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toMatch(/Informe o nome|Confira o CNPJ|telefone/);
    expect(document.activeElement?.id).toBe('sponsor-nome');
    act(() => root.unmount());
  });

  it('a prévia muda com o zoom e recusa arquivo grande', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ contract: { creatives: [] } })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ArtStep contractId="00000000-0000-4000-8000-000000000001" saving={false} onSaving={() => undefined} onBack={() => undefined} onSaved={() => undefined} />);
    });
    const zoom = document.querySelector('input[aria-label="Zoom"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(zoom, '140');
      zoom.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('140%');
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 8)], 'grande.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.body.textContent).toMatch(/2 MB/);
    const link = document.querySelector('#art-link') as HTMLInputElement;
    await act(async () => {
      setter?.call(link, 'https://www.instagram.com/p/teste');
      link.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).toMatch(/página/);
    act(() => root.unmount());
  });

  it('não coloca no ar antes de gerar o contrato e avisa quando os dados mudam', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/document')) {
        return ok({
          document: {
            versao: 1,
            gerado_em: '2026-10-30',
            atual: false,
            texto: 'CONTRATO DE PATROCÍNIO\nTESTE Padaria',
          },
        });
      }
      return ok({
        contract: {
          nome: 'TESTE Padaria',
          documento: '11222333000181',
          telefone: '62900000000',
          email: 'teste@exemplo.test',
          inicio: '2026-11-01',
          fim: '2026-12-31',
          planos_alvo: ['free'],
          slots: ['faixa'],
          valor_centavos: 60000,
          status: 'rascunho',
        },
      });
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<ReviewStep contractId="00000000-0000-4000-8000-000000000001" onBack={() => undefined} onAir={() => undefined} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const air = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Colocar no ar')) as HTMLButtonElement;
    expect(air.disabled).toBe(true);
    expect(document.body.textContent).toMatch(/dados mudaram/);
    expect(document.body.textContent).toContain('TESTE Padaria');
    expect(document.querySelector('mark')?.textContent).toBe('TESTE Padaria');
    act(() => root.unmount());
  });

  it('salva o rascunho, mostra o aviso e abre o passo seguinte', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ sponsor: { id: 's1' } })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MarketingFlow sponsorId={null} contractId={null} onClose={() => undefined} onOpen={() => undefined} />);
    });
    await act(async () => {
      fill('Nome fantasia', 'TESTE Padaria');
      fill('Razão social', 'TESTE Padaria LTDA');
      fill('CNPJ', '11.222.333/0001-81');
      fill('Endereço', 'Rua do Teste, 1');
      fill('Cidade', 'Goiânia');
      fill('Representante', 'TESTE Maria');
      fill('Cargo', 'Sócia');
      fill('Telefone', '62900000000');
      fill('E-mail', 'teste@exemplo.test');
    });
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent === 'Salvar e continuar');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('✓ Patrocinador salvo');
    expect(document.body.textContent).toMatch(/Vence sozinho/);
    act(() => root.unmount());
  });

  it('retoma um rascunho no passo da arte', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({
      contract: { tipo_pessoa: 'pj', creatives: [], forma_pagamento: 'pix' },
    })));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<MarketingFlow sponsorId="s1" contractId="00000000-0000-4000-8000-000000000001" onClose={() => undefined} onOpen={() => undefined} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('.fp-flow-steps button.on')?.textContent).toContain('Arte');
    act(() => root.unmount());
  });
});
