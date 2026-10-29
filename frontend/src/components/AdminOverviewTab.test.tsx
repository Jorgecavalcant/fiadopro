/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminOverviewTab } from './AdminOverviewTab';

const report = {
  success: true,
  from: '2026-04-01',
  to: '2026-04-30',
  preset: '30',
  type: null,
  usuariosAtivos: 17,
  clientes: 23,
  lancamentos: 41,
  volumeConfirmado: 88.5,
  contasBloqueadas: 3,
  contasEncerradas: 5,
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('visão geral — analisar com IA', () => {
  it('deixa o botão desabilitado e um clique não dispara fetch', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => report,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    await act(async () => {
      root.render(<AdminOverviewTab />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const button = Array.from(document.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Analisar com IA'),
    ) as HTMLButtonElement | undefined;

    expect(button).toBeTruthy();
    expect(button?.disabled).toBe(true);
    expect(button?.title).toBe('Em breve');

    const callsBefore = fetchMock.mock.calls.length;
    expect(callsBefore).toBeGreaterThan(0);

    await act(async () => {
      button?.click();
    });

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    const urls = fetchMock.mock.calls.map((call) => String(call));
    expect(urls.some((url) => url.includes('/ai'))).toBe(false);

    act(() => root.unmount());
  });
});
