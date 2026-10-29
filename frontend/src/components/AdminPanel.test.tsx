/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from './AdminPanel';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function user(id: string, name: string) {
  return {
    id,
    email: `${name}@example.test`,
    full_name: name,
    phone: null,
    avatar_url: null,
    role: 'admin',
    is_active: true,
    created_at: '2026-10-29',
    updated_at: '2026-10-29',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('painel admin — bloquear a própria linha', () => {
  it('desabilita o bloqueio na linha do admin logado e mantém o do outro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          users: [user(ADMIN_ID, 'Eu'), user(OTHER_ID, 'Outro')],
          meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
        }),
      })),
    );

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    await act(async () => {
      root.render(<AdminPanel currentUserId={ADMIN_ID} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const own = document.querySelector('button[aria-label="Bloquear a própria conta"]') as HTMLButtonElement | null;
    const other = document.querySelector('button[aria-label="Bloquear acesso"]') as HTMLButtonElement | null;

    expect(own).not.toBeNull();
    expect(own?.disabled).toBe(true);
    expect(other).not.toBeNull();
    expect(other?.disabled).toBe(false);

    await act(async () => {
      other?.click();
    });
    expect(document.body.textContent).toContain('Motivo');
    expect(document.body.textContent).toContain('Não cole CPF, senha ou chave Pix nesta observação.');

    act(() => root.unmount());
  });
});
