/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePanel } from './HomePanel';

let root: Root | undefined;
const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ creative: null }) })));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
  });
});

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(node);
  });
}

describe('início', () => {
  it('esconde os valores e guarda a escolha no aparelho', async () => {
    await render(
      <HomePanel
        userName="TESTE Ana"
        formatCurrency={(value) => `R$ ${value.toFixed(2)}`}
        receivable={350}
        payable={0}
        overdue={0}
        overdueCustomers={0}
        activeDebtors={1}
        onNewDebt={() => undefined}
        onReceive={() => undefined}
        onSplit={() => undefined}
        onNewCustomer={() => undefined}
        onOverdue={() => undefined}
        onPayable={() => undefined}
      />,
    );
    expect(document.body.textContent).toContain('R$ 350.00');
    expect(document.body.textContent).toContain('1 devedor ativo');
    const eye = document.querySelector('.fp-eye') as HTMLButtonElement;
    act(() => {
      eye.click();
    });
    expect(document.body.textContent).toContain('••••');
    expect(document.body.textContent).not.toContain('R$ 350.00');
    expect(memory.get('fiado_pro_hide_values')).toBe('1');
  });

  it('esconde a atenção quando não há itens e o Pro sem anúncio não reserva espaço', async () => {
    await render(
      <HomePanel
        userName="TESTE Ana"
        formatCurrency={(value) => `R$ ${value.toFixed(2)}`}
        receivable={0}
        payable={0}
        overdue={0}
        activeDebtors={0}
        isPro
        adPlan="pro"
        onNewDebt={() => undefined}
        onReceive={() => undefined}
        onSplit={() => undefined}
        onNewCustomer={() => undefined}
      />,
    );
    expect(document.body.textContent).not.toContain('Precisa da sua atenção');
    expect(document.body.textContent).not.toContain('Patrocinado');
  });

  it('mostra no máximo os itens recebidos e o patrocínio no Free', async () => {
    await render(
      <HomePanel
        userName="TESTE Ana"
        formatCurrency={(value) => `R$ ${value.toFixed(2)}`}
        receivable={10}
        payable={0}
        overdue={10}
        activeDebtors={1}
        attention={[
          { customerId: 'a', name: 'TESTE Ana', kind: 'overdue', reason: 'Venceu há 5 dias', amount: 10 },
          { customerId: 'b', name: 'TESTE Bruno', kind: 'dueSoon', reason: 'Vence em 2 dias', amount: 5 },
          { customerId: 'c', name: 'TESTE Carlos', kind: 'refund', reason: 'Você deve devolver', amount: 3 },
        ]}
        onNewDebt={() => undefined}
        onReceive={() => undefined}
        onSplit={() => undefined}
        onNewCustomer={() => undefined}
      />,
    );
    expect(document.body.textContent).toContain('Precisa da sua atenção');
    expect(document.body.textContent).toContain('TESTE Ana');
    expect(document.body.textContent).not.toContain('Patrocinado · Espaço do patrocinador');
    expect(document.querySelector('.fp-sponsor-slot')).toBeNull();
    expect(document.querySelector('[aria-label="Acesso rápido"]')).toBeNull();
    expect(document.querySelectorAll('.fp-attention-row')).toHaveLength(3);
  });
});
