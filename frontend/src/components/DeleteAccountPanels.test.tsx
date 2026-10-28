/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import DeleteAccountPanels from './DeleteAccountPanels';
import { deletionErrorMessage, requestAccountDeletion } from '../utils/deleteAccountFlow';

function clickText(name: string) {
  const el = Array.from(document.querySelectorAll('button,label')).find(
    (item) => item.textContent?.replace(/\s+/g, ' ').trim() === name,
  );
  if (!el) throw new Error(`Texto não encontrado: ${name}`);
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function typeIn(label: string, value: string) {
  const input = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  if (!input) throw new Error(`Campo não encontrado: ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function renderPanel(googleOnly: boolean, onDelete: (confirmation: string) => Promise<string | null>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<DeleteAccountPanels googleOnly={googleOnly} onDelete={onDelete} />);
  });
  return () => {
    act(() => root.unmount());
    host.remove();
  };
}

async function openFinalConfirmation() {
  clickText('Cancelar Conta');
  clickText('Continuar');
  clickText('Não uso mais');
  clickText('Confirmar');
}

describe('exclusão de conta', () => {
  it('mostra a mensagem da API em vez do objeto de erro', () => {
    expect(deletionErrorMessage({ error: { code: 'INVALID_PASSWORD', message: 'Senha incorreta' } })).toBe('Senha incorreta');
    expect(deletionErrorMessage({ error: { code: 'X' } })).toBe('Não foi possível excluir a conta. Tente de novo.');
  });

  it('pede a senha uma vez e chama DELETE /api/users/me', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    const cleanup = await renderPanel(false, (confirmation) =>
      requestAccountDeletion('https://fiado.test/api/users/me', confirmation, fetchMock as unknown as typeof fetch),
    );

    await openFinalConfirmation();
    expect(document.body.textContent).toContain('Última confirmação');
    expect(fetchMock).not.toHaveBeenCalled();

    clickText('Excluir Tudo Permanentemente');
    expect(document.body.textContent).not.toContain('Última confirmação');
    expect(document.body.textContent).toContain('Excluir minha conta');
    expect(document.querySelector('[aria-label="Senha"]')?.getAttribute('type')).toBe('password');

    typeIn('Senha', 'senha-da-conta');
    await act(async () => {
      clickText('Excluir conta');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://fiado.test/api/users/me');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe(JSON.stringify({ password: 'senha-da-conta' }));
    cleanup();
  });

  it('pede CANCELAR uma vez, visível, para conta só com Google', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    const cleanup = await renderPanel(true, (confirmation) =>
      requestAccountDeletion('https://fiado.test/api/users/me', confirmation, fetchMock as unknown as typeof fetch),
    );

    await openFinalConfirmation();
    clickText('Excluir Tudo Permanentemente');
    const field = document.querySelector('[aria-label="Digite CANCELAR"]') as HTMLInputElement;
    expect(field.getAttribute('type')).toBe('text');
    expect(fetchMock).not.toHaveBeenCalled();

    typeIn('Digite CANCELAR', 'cancelar');
    expect((document.querySelector('[aria-label="Digite CANCELAR"]') as HTMLInputElement).value).toBe('CANCELAR');
    await act(async () => {
      clickText('Excluir conta');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe(JSON.stringify({ password: 'CANCELAR' }));
    cleanup();
  });

  it('mostra a frase de erro quando a API devolve um objeto', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Senha incorreta' } }),
    }));
    const cleanup = await renderPanel(false, (confirmation) =>
      requestAccountDeletion('https://fiado.test/api/users/me', confirmation, fetchMock as unknown as typeof fetch),
    );
    await openFinalConfirmation();
    clickText('Excluir Tudo Permanentemente');
    typeIn('Senha', 'errada');
    await act(async () => {
      clickText('Excluir conta');
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Senha incorreta');
    cleanup();
  });
});
