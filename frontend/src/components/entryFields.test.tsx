/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import BrDateField from './BrDateField';
import CurrencyInput from './CurrencyInput';
import SaveButton from './SaveButton';
import { amountFieldMessage, descriptionFieldMessage } from '../utils/formatBr';

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function field(root: ParentNode, label: string) {
  const input = root.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  if (!input) throw new Error(`Campo não encontrado: ${label}`);
  return input;
}

function EntryHarness({ onSent }: { onSent: (amount: number | null) => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [due, setDue] = useState('');
  const [amountError, setAmountError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const nextAmount = amountFieldMessage(amount);
        const nextDescription = descriptionFieldMessage(description);
        setAmountError(nextAmount);
        setDescriptionError(nextDescription);
        if (nextAmount || nextDescription) return;
        setSaving(true);
        onSent(amount);
      }}
    >
      <CurrencyInput aria-label="Valor" value={amount} onChange={setAmount} />
      {amountError ? <p role="alert">{amountError}</p> : null}
      <input
        aria-label="Descrição"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {descriptionError ? <p role="alert">{descriptionError}</p> : null}
      <BrDateField ariaLabel="Data de Vencimento" value={due} onChange={setDue} />
      <span data-iso={due} />
      <button
        type="button"
        onClick={() => {
          setAmount(10000);
          setAmountError('');
        }}
      >
        Quitar
      </button>
      <SaveButton saving={saving} label="Confirmar" />
    </form>
  );
}

async function renderHarness() {
  document.body.innerHTML = '';
  const sent: Array<number | null> = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<EntryHarness onSent={(amount) => sent.push(amount)} />);
  });
  return {
    host,
    sent,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function clickConfirmar(root: ParentNode) {
  const button = Array.from(root.querySelectorAll('button')).find(
    (item) => item.textContent === 'Confirmar',
  );
  if (!button) throw new Error('Botão Confirmar não encontrado');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

async function typeCash(root: ParentNode, digits: string) {
  for (const digit of digits) {
    const input = field(root, 'Valor');
    await act(async () => {
      setNativeValue(input, `${input.value}${digit}`);
    });
  }
}

describe('campos de lançamento', () => {
  it('valor 0 mostra a mensagem e não envia', async () => {
    const view = await renderHarness();
    await act(async () => {
      setNativeValue(field(view.host, 'Valor'), '0');
      setNativeValue(field(view.host, 'Descrição'), 'Fiado');
    });
    await act(async () => {
      clickConfirmar(view.host);
    });
    expect(view.host.textContent).toContain('Informe um valor maior que zero');
    expect(view.sent).toEqual([]);
    view.cleanup();
  });

  it('descrição vazia mostra a mensagem em português', async () => {
    const view = await renderHarness();
    await typeCash(view.host, '100');
    await act(async () => {
      clickConfirmar(view.host);
    });
    expect(view.host.textContent).toContain('Informe uma descrição');
    expect(view.sent).toEqual([]);
    view.cleanup();
  });

  it('mostra a data em dd/mm/aaaa', async () => {
    const view = await renderHarness();
    await act(async () => {
      setNativeValue(field(view.host, 'Data de Vencimento'), '29102026');
    });
    expect(field(view.host, 'Data de Vencimento').value).toBe('29/10/2026');
    expect(view.host.querySelector('[data-iso]')?.getAttribute('data-iso')).toBe('2026-10-29');
    view.cleanup();
  });

  it('mostra Salvando... com o spinner enquanto envia', async () => {
    const view = await renderHarness();
    await typeCash(view.host, '100');
    await act(async () => {
      setNativeValue(field(view.host, 'Descrição'), 'Fiado');
    });
    await act(async () => {
      clickConfirmar(view.host);
    });
    const button = Array.from(view.host.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Salvando...'),
    );
    expect(button).toBeTruthy();
    expect(button?.querySelector('svg')).toBeTruthy();
    expect(button?.hasAttribute('disabled')).toBe(true);
    view.cleanup();
  });

  it('digitar 1000000 mostra R$ 10.000,00 e o envio é o número 10000', async () => {
    const view = await renderHarness();
    await typeCash(view.host, '1000000');
    expect(field(view.host, 'Valor').value).toBe('R$ 10.000,00');
    await act(async () => {
      setNativeValue(field(view.host, 'Descrição'), 'Fiado');
    });
    await act(async () => {
      clickConfirmar(view.host);
    });
    expect(view.sent).toEqual([10000]);
    expect(typeof view.sent[0]).toBe('number');
    view.cleanup();
  });

  it('colar 1.234,56 envia o número 1234.56', async () => {
    const view = await renderHarness();
    await act(async () => {
      setNativeValue(field(view.host, 'Valor'), '1.234,56');
      setNativeValue(field(view.host, 'Descrição'), 'Fiado');
    });
    expect(field(view.host, 'Valor').value).toBe('R$ 1.234,56');
    await act(async () => {
      clickConfirmar(view.host);
    });
    expect(typeof view.sent[0]).toBe('number');
    expect(Math.round((view.sent[0] ?? 0) * 100)).toBe(123456);
    expect(String(view.sent[0])).not.toMatch(/R\$/);
    view.cleanup();
  });

  it('centavos 0,01 e 999.999,99 e o Quitar preenchem o campo formatado', async () => {
    const view = await renderHarness();
    await typeCash(view.host, '1');
    expect(field(view.host, 'Valor').value).toBe('R$ 0,01');
    await act(async () => {
      setNativeValue(field(view.host, 'Valor'), '999.999,99');
    });
    expect(field(view.host, 'Valor').value).toBe('R$ 999.999,99');
    const quitar = Array.from(view.host.querySelectorAll('button')).find(
      (item) => item.textContent === 'Quitar',
    );
    await act(async () => {
      quitar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(field(view.host, 'Valor').value).toBe('R$ 10.000,00');
    view.cleanup();
  });
});
