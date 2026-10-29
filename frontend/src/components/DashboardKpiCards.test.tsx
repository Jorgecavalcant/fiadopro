/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import DashboardKpiCards from './DashboardKpiCards';

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
});

function renderCards() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <DashboardKpiCards
        items={[
          {
            label: 'Total a Receber',
            value: 'R$ 1.234,56',
            sub: '3 devedores ativos',
            icon: <span>↑</span>,
            iconBg: '#EEF2FF',
            iconColor: '#4F46E5',
            accent: 'primary',
          },
          {
            label: 'Insights IA',
            value: 'PRO',
            sub: 'Análise inteligente do negócio',
            icon: <span>✦</span>,
            iconBg: '#F3E8FF',
            iconColor: '#7C3AED',
            accent: 'warning',
          },
        ]}
      />,
    );
  });
}

describe('cards do Dashboard', () => {
  it('mostra o título e o valor de cada card, inclusive o PRO', () => {
    renderCards();

    expect(document.body.textContent).toContain('Total a Receber');
    expect(document.body.textContent).toContain('R$ 1.234,56');
    expect(document.body.textContent).toContain('Insights IA');
    expect(document.body.textContent).toContain('PRO');

    const value = document.querySelector('.fp-kpi-value');
    expect(value?.getAttribute('title')).toBe('R$ 1.234,56');
    expect(document.querySelectorAll('.fp-kpi-card')).toHaveLength(2);
  });
});
