/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePanel } from './HomePanel';

let root: Root | undefined;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ creative: null }) })));
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
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

const baseProps = {
  userName: 'Ana',
  formatCurrency: (value: number) => `R$ ${value}`,
  receivable: 0,
  overdue: 0,
  activeDebtors: 0,
  onNewDebt: () => undefined,
  onReceive: () => undefined,
  onSplit: () => undefined,
  onNewCustomer: () => undefined,
};

describe('HomePanel notification bell', () => {
  it('shows badge with pending count next to avatar', async () => {
    await render(<HomePanel {...baseProps} notificationCount={3} />);
    const bell = document.querySelector('.fp-bell') as HTMLButtonElement | null;
    expect(bell?.getAttribute('aria-label')).toBe('Notificações');
    expect(document.body.textContent).toContain('3');
  });
});
