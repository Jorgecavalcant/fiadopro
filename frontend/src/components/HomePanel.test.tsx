/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePanel } from './HomePanel';
import { sumConfirmed } from '../utils/ledgerPeriod';

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

const baseProps = {
  userName: 'TESTE Ana',
  formatCurrency: (value: number) => `R$ ${value.toFixed(2)}`,
  receivable: 350,
  receivedTotal: 0,
  overdue: 0,
  overdueCustomers: 0,
  activeDebtors: 1,
  onNewDebt: () => undefined,
  onReceive: () => undefined,
  onSplit: () => undefined,
  onNewCustomer: () => undefined,
};

describe('início', () => {
  it('esconde os valores e guarda a escolha no aparelho', async () => {
    await render(<HomePanel {...baseProps} />);
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
        {...baseProps}
        receivable={0}
        activeDebtors={0}
        isPro
        adPlan="pro"
      />,
    );
    expect(document.body.textContent).not.toContain('Precisa da sua atenção');
    expect(document.body.textContent).not.toContain('Patrocinado');
  });

  it('mostra no máximo os itens recebidos e o patrocínio no Free', async () => {
    await render(
      <HomePanel
        {...baseProps}
        receivable={10}
        overdue={10}
        attention={[
          { customerId: 'a', name: 'TESTE Ana', kind: 'overdue', reason: 'Venceu há 5 dias', amount: 10 },
          { customerId: 'b', name: 'TESTE Bruno', kind: 'dueSoon', reason: 'Vence em 2 dias', amount: 5 },
          { customerId: 'c', name: 'TESTE Carlos', kind: 'refund', reason: 'Você deve devolver', amount: 3 },
        ]}
      />,
    );
    expect(document.body.textContent).toContain('Precisa da sua atenção');
    expect(document.body.textContent).toContain('TESTE Ana');
    expect(document.body.textContent).not.toContain('Patrocinado · Espaço do patrocinador');
    expect(document.querySelector('.fp-sponsor-slot')).toBeNull();
    expect(document.querySelector('[aria-label="Acesso rápido"]')).toBeNull();
    expect(document.querySelectorAll('.fp-attention-row')).toHaveLength(3);
  });

  it('mostra Me devem, Recebi e Em atraso em cards separados e clicáveis', async () => {
    const onReceivable = vi.fn();
    const onReceived = vi.fn();
    const onOverdue = vi.fn();
    await render(
      <HomePanel
        {...baseProps}
        receivable={250}
        receivedTotal={180}
        overdue={40}
        onReceivable={onReceivable}
        onReceived={onReceived}
        onOverdue={onOverdue}
      />,
    );

    const text = document.body.textContent ?? '';
    expect(text).toContain('Me devem');
    expect(text).toContain('Recebi');
    expect(text).toContain('Em atraso');
    expect(text).not.toContain('A receber');
    expect(text).not.toContain('A pagar');
    expect(document.querySelectorAll('.fp-balance-tile')).toHaveLength(3);
    expect(document.querySelector('.fp-amt-debt')?.textContent).toContain('250.00');
    expect(document.querySelector('.fp-amt-paid')?.textContent).toContain('180.00');
    expect(document.querySelector('.fp-balance-tile strong.danger')?.textContent).toContain('40.00');

    act(() => {
      (document.querySelector('[aria-label="Me devem"]') as HTMLButtonElement).click();
    });
    act(() => {
      (document.querySelector('[aria-label="Recebi"]') as HTMLButtonElement).click();
    });
    act(() => {
      (document.querySelector('[aria-label="Em atraso"]') as HTMLButtonElement).click();
    });
    expect(onReceivable).toHaveBeenCalledTimes(1);
    expect(onReceived).toHaveBeenCalledTimes(1);
    expect(onOverdue).toHaveBeenCalledTimes(1);
  });

  it('Recebi usa a soma de pagamentos confirmados (ignora pendente e dívida)', () => {
    const now = Date.now();
    const receivedTotal = sumConfirmed([
      { type: 'PAYMENT', amount: 100, status: 'CONFIRMED', timestamp: now },
      { type: 'PAYMENT', amount: 50, status: 'CONFIRMED', timestamp: now },
      { type: 'PAYMENT', amount: 999, status: 'PENDING', timestamp: now },
      { type: 'DEBT', amount: 200, status: 'CONFIRMED', timestamp: now },
    ]).payment;
    expect(receivedTotal).toBe(150);
  });
});
