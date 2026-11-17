/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
});

function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(node);
  });
  return host;
}

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('ações Me deve / Me pagaram na ficha e no Acesso Rápido', () => {
  it('App.tsx: ficha do cliente usa labels e degradês do PR #71', () => {
    const detailStart = appSource.indexOf('fp-detail-actions');
    expect(detailStart).toBeGreaterThan(-1);
    const detailBlock = appSource.slice(detailStart, detailStart + 1800);

    expect(detailBlock).toContain('aria-label="Me deve"');
    expect(detailBlock).toContain('title="Me deve"');
    expect(detailBlock).toContain('fp-quick-pill fp-quick-pill--debt');
    expect(detailBlock).toContain('>Me deve<');
    expect(detailBlock).toContain('aria-label="Me pagaram"');
    expect(detailBlock).toContain('fp-quick-pill fp-quick-pill--paid');
    expect(detailBlock).toContain('>Me pagaram<');
    expect(detailBlock).toContain('ArrowUpRight');
    expect(detailBlock).toContain('ArrowDownLeft');
    expect(detailBlock).not.toMatch(/Nova despesa/i);
    expect(detailBlock).toContain('Abatimento');
    expect(detailBlock).toContain('Devolução');
  });

  it('App.tsx: Acesso Rápido passo 1 usa labels e degradês, sem nomes antigos', () => {
    const quickStart = appSource.indexOf('quickAddStep === 1');
    expect(quickStart).toBeGreaterThan(-1);
    const quickBlock = appSource.slice(quickStart, quickStart + 2200);

    expect(quickBlock).toContain("label: 'Me deve'");
    expect(quickBlock).toContain("label: 'Me pagaram'");
    expect(quickBlock).toContain('fp-quick-pill fp-quick-pill--debt');
    expect(quickBlock).toContain('fp-quick-pill fp-quick-pill--paid');
    expect(quickBlock).toContain('aria-label={btn.label}');
    expect(quickBlock).toContain('title={btn.label}');
    expect(quickBlock).not.toContain('Lançar Dívida');
    expect(quickBlock).not.toContain('Receber Pagamento');
    expect(quickBlock).not.toContain('#FEF2F2');
    expect(quickBlock).not.toContain('#F0FDF4');
  });

  it('render da ficha: Me deve com --debt e Me pagaram com --paid', () => {
    render(
      <div className="fp-shortcuts fp-detail-actions">
        <button type="button" className="fp-quick" aria-label="Me deve" title="Me deve">
          <span className="fp-quick-pill fp-quick-pill--debt">
            <ArrowUpRight size={22} strokeWidth={1.5} color="#fff" />
          </span>
          <span className="fp-quick-label">Me deve</span>
        </button>
        <button type="button" className="fp-quick" aria-label="Me pagaram" title="Me pagaram">
          <span className="fp-quick-pill fp-quick-pill--paid">
            <ArrowDownLeft size={22} strokeWidth={1.5} color="#fff" />
          </span>
          <span className="fp-quick-label">Me pagaram</span>
        </button>
      </div>,
    );

    const text = document.body.textContent ?? '';
    expect(text).toContain('Me deve');
    expect(text).toContain('Me pagaram');
    expect(text).not.toMatch(/Nova despesa|Lançar Dívida|Receber Pagamento/i);
    expect(document.querySelector('.fp-quick-pill--debt')).toBeTruthy();
    expect(document.querySelector('.fp-quick-pill--paid')).toBeTruthy();
    expect(document.querySelector('.fp-quick[aria-label="Me deve"]')).toBeTruthy();
    expect(document.querySelector('.fp-quick[aria-label="Me pagaram"]')).toBeTruthy();
    expect(document.querySelector('.fp-quick-pill--debt svg')).toBeTruthy();
    expect(document.querySelector('.fp-quick-pill--paid svg')).toBeTruthy();
  });

  it('render do Acesso Rápido passo 1: labels novos e classes de degradê', () => {
    render(
      <div>
        <button type="button" aria-label="Me deve" title="Me deve">
          <span className="fp-quick-pill fp-quick-pill--debt">
            <ArrowUpRight size={22} strokeWidth={1.5} color="#fff" />
          </span>
          <span>Me deve</span>
        </button>
        <button type="button" aria-label="Me pagaram" title="Me pagaram">
          <span className="fp-quick-pill fp-quick-pill--paid">
            <ArrowDownLeft size={22} strokeWidth={1.5} color="#fff" />
          </span>
          <span>Me pagaram</span>
        </button>
      </div>,
    );

    const text = document.body.textContent ?? '';
    expect(text).toContain('Me deve');
    expect(text).toContain('Me pagaram');
    expect(text).not.toContain('Lançar Dívida');
    expect(text).not.toContain('Receber Pagamento');
    expect(document.querySelector('.fp-quick-pill--debt')).toBeTruthy();
    expect(document.querySelector('.fp-quick-pill--paid')).toBeTruthy();
  });
});
