/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations } from '../translations';
import { showQuickFab } from '../utils/quickFab';
import { AppView } from '../types';
import { AiAsk } from './AiAsk';
import { CustomerIdentity } from './CustomerIdentity';
import { LedgerTitle } from './ui/LedgerTitle';
import { PageHeader } from './ui/PageHeader';

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
}

describe('detalhe do cliente', () => {
  it('mostra o nome uma vez só, no cabeçalho', () => {
    render(
      <>
        <PageHeader title="TESTE Bruno" onBack={() => undefined} />
        <CustomerIdentity
          name="TESTE Bruno"
          phone="11900000000"
          balanceText="Te deve R$ 350,00"
          balanceColor="#B3261E"
          score={620}
          scoreLabel="Positivo"
        />
      </>,
    );
    const times = document.body.textContent?.match(/TESTE Bruno/g) ?? [];
    expect(times).toHaveLength(1);
    expect(document.body.textContent).toContain('(11) 90000-0000');
  });
});

describe('pergunta à IA', () => {
  it('no Free não chama serviço e convida para o Pro', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onUpgrade = vi.fn();
    render(<AiAsk isPro={false} canUpgrade onUpgrade={onUpgrade} />);
    const input = document.querySelector('input') as HTMLInputElement;
    const form = document.querySelector('form') as HTMLFormElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Quem mais atrasa?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('A IA é do plano Pro');
    act(() => {
      (document.body.querySelector('.fp-ai-pro button') as HTMLButtonElement).click();
    });
    expect(onUpgrade).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('no Pro mostra Em breve e também não chama serviço', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AiAsk isPro canUpgrade={false} onUpgrade={() => undefined} />);
    const input = document.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Quem mais atrasa?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      (document.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Em breve');
    vi.unstubAllGlobals();
  });
});

describe('acabamento', () => {
  it('não mostra o botão flutuante no Início', () => {
    expect(showQuickFab(AppView.DASHBOARD)).toBe(false);
    expect(showQuickFab(AppView.CUSTOMERS)).toBe(true);
  });

  it('não corta o nome do lançamento', () => {
    render(<LedgerTitle text="TESTE Cliente com nome longo demais para uma linha" />);
    expect(document.body.textContent).toContain('TESTE Cliente com nome longo demais para uma linha');
    expect(document.body.textContent).not.toContain('...');
    expect(document.querySelector('.fp-ledger-title')?.className).not.toContain('line-clamp');
  });

  it('usa frase normal nos rótulos dos formulários', () => {
    const pt = translations['pt-BR'];
    expect(pt.fullName).toBe('Nome completo');
    expect(pt.pixKeyLabel).toBe('Chave Pix');
    expect(pt.dueDate).toBe('Data de vencimento');
    expect(pt.relatedEvent).toBe('Evento relacionado (opcional)');
    expect(pt.confirmTransaction).toBe('Confirmar');
    expect(pt.saveChanges).toBe('Salvar alterações');
    expect(pt.newEvent).toBe('Novo evento');
  });
});
