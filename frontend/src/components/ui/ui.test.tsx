/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ArrowDownLeft, Undo2, Users } from 'lucide-react';
import { AppView } from '../../types';
import Layout from '../Layout';
import { Button } from './Button';
import { Chip } from './Chip';
import { ListRow } from './ListRow';
import { Notice } from './Notice';
import { PageHeader } from './PageHeader';
import { QuickAction } from './QuickAction';
import { SearchField } from './SearchField';

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

describe('componentes da base visual', () => {
  it('mostra botão, lista, aviso, chip e busca sem cortar o rótulo', () => {
    render(
      <div>
        <Button>Salvar</Button>
        <ListRow icon={Users} title="TESTE Ana" subtitle="Te deve" amount="R$ 10,00" />
        <Notice title="Você deve R$ 10,00 a esta pessoa">Use Devolver ou Abater.</Notice>
        <Chip label="30 dias" selected />
        <SearchField value="" onChange={() => undefined} label="Buscar" />
        <QuickAction icon={ArrowDownLeft} label="Receber" />
        <QuickAction icon={Undo2} label="Devolver" />
        <QuickAction icon={Users} label="Dividir" />
        <PageHeader title="TESTE Ana" onBack={() => undefined} />
      </div>,
    );

    const text = document.body.textContent ?? '';
    expect(text).toContain('Salvar');
    expect(text).toContain('TESTE Ana');
    expect(text).toContain('Use Devolver ou Abater.');
    expect(text).toContain('30 dias');
    expect(text).toContain('Receber');
    expect(text).toContain('Devolver');
    expect(text).toContain('Dividir');
    expect(document.querySelector('.fp-notice button')).toBeNull();
    expect(document.querySelector('.fp-page-head')?.textContent).not.toContain('Voltar');
    expect(document.querySelectorAll('.fp-quick-label').length).toBe(3);
  });

  it('a navegação tem Início, Pessoas, Extrato e Menu', () => {
    render(
      <Layout
        activeView={AppView.DASHBOARD}
        setActiveView={() => undefined}
        language="pt-BR"
        setLanguage={() => undefined}
        isPro={false}
        onUpgrade={() => undefined}
        user={{ id: '1', name: 'TESTE Ana', email: 'teste.ana@example.test' }}
        onLogout={() => undefined}
      >
        <p>conteúdo</p>
      </Layout>,
    );

    const labels = [...document.querySelectorAll('.fp-tabbar button')].map((button) => button.textContent);
    expect(labels).toEqual(['Início', 'Pessoas', 'Extrato', 'Menu']);
  });
});
