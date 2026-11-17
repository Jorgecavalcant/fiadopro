/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { StatementView } from './StatementView';
import type { Customer, Transaction } from '../types';

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
});

async function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(node);
  });
}

const customers: Customer[] = [
  {
    id: 'c1',
    name: 'TESTE Ana',
    phone: '',
    createdAt: Date.now(),
  },
];

describe('extrato', () => {
  it('resumo usa Me devem / Me pagaram e Falta receber no período', async () => {
    const now = Date.now();
    const transactions: Transaction[] = [
      {
        id: 't1',
        customerId: 'c1',
        type: 'DEBT',
        amount: 200,
        status: 'CONFIRMED',
        timestamp: now,
        description: 'Fiado',
      },
      {
        id: 't2',
        customerId: 'c1',
        type: 'PAYMENT',
        amount: 50,
        status: 'CONFIRMED',
        timestamp: now,
        description: 'PIX',
      },
    ];

    await render(
      <StatementView
        transactions={transactions}
        customers={customers}
        formatCurrency={(value) => `R$ ${value.toFixed(2)}`}
      />,
    );

    const text = document.body.textContent ?? '';
    expect(text).toContain('Me devem');
    expect(text).toContain('Me pagaram');
    expect(text).toContain('Falta receber no período');
    expect(text).not.toContain('Lançado');
    expect(text).not.toContain('A receber no período');
  });
});
