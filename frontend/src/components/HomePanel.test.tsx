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

function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(node);
  });
}

describe('início', () => {
  it('esconde os valores e guarda a escolha no aparelho', () => {
    render(
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
});
