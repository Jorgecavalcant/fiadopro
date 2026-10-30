/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction, TransactionType } from '../types';
import { computeRawBalance } from '../utils/credit';
import { amountFieldMessage } from '../utils/formatBr';
import { pastZeroPrompt } from '../utils/launchBalance';
import CurrencyInput from './CurrencyInput';
import SaveButton from './SaveButton';
import { CreditBalanceNotice, CurrentBalanceBanner, WholeBalanceButton } from './BalancePanels';

function money(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function row(type: TransactionType, amount: number): Transaction {
  return {
    id: `${type}-${amount}`,
    customerId: 'c1',
    amount,
    type,
    description: 'Lançamento',
    timestamp: 1,
    status: 'CONFIRMED',
  };
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function LaunchHarness({ initial }: { initial: Transaction[] }) {
  const [rows, setRows] = useState(initial);
  const [type, setType] = useState<TransactionType>('REFUND');
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('Acerto');
  const [amountError, setAmountError] = useState('');
  const [saving, setSaving] = useState(false);
  const balance = computeRawBalance(rows);
  const open = (next: TransactionType) => {
    setType(next);
    setAmount(null);
    setAmountError('');
    setSaving(false);
  };
  return (
    <div>
      <button type="button" onClick={() => open('DEBT')}>
        Nova Despesa
      </button>
      <button type="button" onClick={() => open('PAYMENT')}>
        Registrar Pagamento
      </button>
      <button type="button" onClick={() => open('REFUND')}>
        Registrar Devolução
      </button>
      <button type="button" onClick={() => open('ABATIMENTO')}>
        Registrar Abatimento
      </button>
      <CurrentBalanceBanner rawBalance={balance} formatCurrency={money} />
      <CreditBalanceNotice rawBalance={balance} formatCurrency={money} />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const nextAmountError = amountFieldMessage(amount);
          setAmountError(nextAmountError);
          if (nextAmountError || !description.trim()) return;
          if (type === 'REFUND' || type === 'ABATIMENTO') {
            const prompt = pastZeroPrompt({
              type,
              name: 'Cliente',
              balance,
              amount: amount ?? 0,
              formatCurrency: money,
            });
            if (prompt && !window.confirm(prompt)) return;
          }
          setSaving(true);
          setRows((prev) => [...prev, row(type, amount ?? 0)]);
        }}
      >
        <CurrencyInput
          aria-label="Valor"
          value={amount}
          onChange={(next) => {
            setAmount(next);
            if (amountError) setAmountError('');
          }}
        />
        {amountError ? <p role="alert">{amountError}</p> : null}
        <WholeBalanceButton type={type} rawBalance={balance} onFill={setAmount} />
        <input
          aria-label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <SaveButton saving={saving} label="Confirmar" />
      </form>
    </div>
  );
}

async function renderHarness(initial: Transaction[]) {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<LaunchHarness initial={initial} />);
  });
  return {
    host,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function clickText(root: ParentNode, label: string) {
  const button = Array.from(root.querySelectorAll('button')).find(
    (item) => item.textContent === label,
  );
  if (!button) throw new Error(`Botão não encontrado: ${label}`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function amountInput(root: ParentNode) {
  const input = root.querySelector('[aria-label="Valor"]') as HTMLInputElement | null;
  if (!input) throw new Error('Campo de valor não encontrado');
  return input;
}

describe('saldo nas abas e aviso credor', () => {
  it('mostra o saldo em Devolução e Abatimento', async () => {
    const view = await renderHarness([row('PAYMENT', 425)]);
    expect(view.host.textContent).toContain('Saldo atual');
    expect(view.host.textContent).toContain('Você deve');
    expect(view.host.textContent).toContain('425,00');
    await act(async () => {
      clickText(view.host, 'Registrar Abatimento');
    });
    expect(view.host.textContent).toContain('Saldo atual');
    expect(view.host.textContent).toContain('Você deve');
    view.cleanup();
  });

  it('Devolver tudo preenche 425,00 e depois de salvar fica Em dia', async () => {
    const view = await renderHarness([row('PAYMENT', 425)]);
    await act(async () => {
      clickText(view.host, 'Devolver tudo');
    });
    expect(amountInput(view.host).value).toBe('R$ 425,00');
    await act(async () => {
      clickText(view.host, 'Confirmar');
    });
    expect(view.host.textContent).toContain('Em dia');
    expect(view.host.textContent).toContain('Salvando...');
    expect(view.host.querySelector('[data-credit-notice]')).toBeNull();
    view.cleanup();
  });

  it('Abater tudo preenche 350,00 e depois de salvar fica Em dia', async () => {
    const view = await renderHarness([row('DEBT', 350)]);
    await act(async () => {
      clickText(view.host, 'Registrar Abatimento');
    });
    expect(view.host.textContent).toContain('Te deve');
    expect(view.host.textContent).toContain('350,00');
    await act(async () => {
      clickText(view.host, 'Abater tudo');
    });
    expect(amountInput(view.host).value).toBe('R$ 350,00');
    await act(async () => {
      clickText(view.host, 'Confirmar');
    });
    expect(view.host.textContent).toContain('Em dia');
    view.cleanup();
  });

  it('valor que passa do saldo pede confirmação nas duas abas', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const refund = await renderHarness([row('PAYMENT', 425)]);
    await act(async () => {
      setNativeValue(amountInput(refund.host), '426,00');
    });
    await act(async () => {
      clickText(refund.host, 'Confirmar');
    });
    expect(confirm).toHaveBeenCalled();
    expect(String(confirm.mock.calls.at(-1)?.[0])).toContain('passa disso');
    expect(refund.host.textContent).toContain('Você deve');
    expect(refund.host.textContent).not.toContain('Salvando...');
    refund.cleanup();

    confirm.mockClear();
    const abate = await renderHarness([row('DEBT', 350)]);
    await act(async () => {
      clickText(abate.host, 'Registrar Abatimento');
    });
    await act(async () => {
      setNativeValue(amountInput(abate.host), '400,00');
    });
    await act(async () => {
      clickText(abate.host, 'Confirmar');
    });
    expect(confirm).toHaveBeenCalled();
    expect(String(confirm.mock.calls.at(-1)?.[0])).toContain('crédito');
    expect(abate.host.textContent).toContain('Te deve');
    confirm.mockRestore();
    abate.cleanup();
  });

  it('o aviso aparece só com saldo credor, sem botões e sem Acerto de Lucro', async () => {
    const credit = await renderHarness([row('PAYMENT', 425)]);
    const notice = credit.host.querySelector('[data-credit-notice]');
    expect(notice).toBeTruthy();
    expect(notice?.textContent).toContain('Você deve');
    expect(notice?.textContent).toContain('425,00');
    expect(notice?.textContent).toContain('a esta pessoa');
    expect(notice?.textContent).toContain('Use Devolução para devolver o dinheiro');
    expect(notice?.querySelector('button')).toBeNull();
    expect(notice?.textContent).not.toContain('Acerto de Lucro');
    expect(credit.host.textContent).not.toContain('Acerto de Lucro');
    credit.cleanup();

    const debt = await renderHarness([row('DEBT', 350)]);
    expect(debt.host.querySelector('[data-credit-notice]')).toBeNull();
    expect(debt.host.textContent).not.toContain('Acerto de Lucro');
    debt.cleanup();

    const even = await renderHarness([]);
    expect(even.host.textContent).toContain('Em dia');
    expect(even.host.querySelector('[data-credit-notice]')).toBeNull();
    even.cleanup();
  });

  it('as quatro abas mostram saldo, campo de valor e Salvando...', async () => {
    const view = await renderHarness([row('DEBT', 80)]);
    for (const tab of [
      'Nova Despesa',
      'Registrar Pagamento',
      'Registrar Devolução',
      'Registrar Abatimento',
    ]) {
      await act(async () => {
        clickText(view.host, tab);
      });
      expect(view.host.textContent).toContain('Saldo atual');
      expect(amountInput(view.host)).toBeTruthy();
    }
    await act(async () => {
      clickText(view.host, 'Nova Despesa');
      setNativeValue(amountInput(view.host), '0');
    });
    await act(async () => {
      clickText(view.host, 'Confirmar');
    });
    expect(view.host.textContent).toContain('Informe um valor maior que zero');
    view.cleanup();
  });
});
