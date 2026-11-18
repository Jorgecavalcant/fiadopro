/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompleteSignupGate, needsPhoneCompletion } from './CompleteSignupGate';

let root: Root | undefined;

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('needsPhoneCompletion', () => {
  it('requires a phone when the user or phone is missing', () => {
    expect(needsPhoneCompletion(null)).toBe(true);
    expect(needsPhoneCompletion(undefined)).toBe(true);
    expect(needsPhoneCompletion({ phone: null })).toBe(true);
  });

  it('accepts Brazilian phone numbers with 10 or 11 digits, including country code', () => {
    expect(needsPhoneCompletion({ phone: '(11) 2345-6789' })).toBe(false);
    expect(needsPhoneCompletion({ phone: '+55 (11) 92345-6789' })).toBe(false);
  });

  it('requires completion for an invalid phone number', () => {
    expect(needsPhoneCompletion({ phone: '12345' })).toBe(true);
  });
});

describe('CompleteSignupGate', () => {
  it('shows the signup title when open', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<CompleteSignupGate open onSaved={() => undefined} />);
    });
    expect(document.body.textContent).toContain('Falta pouco para começar');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('input#signup-phone')).not.toBeNull();
  });

  it('keeps keyboard focus inside the required signup gate', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<CompleteSignupGate open onSaved={() => undefined} />);
    });

    const input = document.querySelector<HTMLInputElement>('#signup-phone');
    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(input).not.toBeNull();
    expect(button).not.toBeNull();
    expect(document.activeElement).toBe(input);

    button?.focus();
    button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(input);

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(button);
  });

  it('hides the app from assistive technology and restores focus when closed', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Entrar';
    document.body.appendChild(trigger);
    trigger.focus();

    const host = document.createElement('div');
    host.id = 'root';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<CompleteSignupGate open onSaved={() => undefined} />);
    });
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.inert).toBe(true);

    await act(async () => {
      root?.render(<CompleteSignupGate open={false} onSaved={() => undefined} />);
    });
    expect(host.hasAttribute('aria-hidden')).toBe(false);
    expect(host.inert).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('saves a valid phone using the existing profile endpoint', async () => {
    const onSaved = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<CompleteSignupGate open onSaved={onSaved} />);
    });

    const input = document.querySelector<HTMLInputElement>('#signup-phone');
    const form = document.querySelector('form');
    await act(async () => {
      if (input) {
        setInputValue(input, '(11) 92345-6789');
      }
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ phone: '11923456789' }) }),
    );
    expect(onSaved).toHaveBeenCalledWith('11923456789');
  });

  it('keeps the modal open and reports an API error', async () => {
    const onError = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<CompleteSignupGate open onSaved={() => undefined} onError={onError} />);
    });

    const input = document.querySelector<HTMLInputElement>('#signup-phone');
    const form = document.querySelector('form');
    await act(async () => {
      if (input) {
        setInputValue(input, '11923456789');
      }
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Não foi possível salvar seu telefone. Tente novamente.');
    expect(onError).toHaveBeenCalledWith('Não foi possível salvar seu telefone. Tente novamente.');
  });
});
