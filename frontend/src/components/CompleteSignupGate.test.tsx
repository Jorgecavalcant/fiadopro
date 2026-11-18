/**
 * @vitest-environment happy-dom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CompleteSignupGate, needsPhoneCompletion } from './CompleteSignupGate';

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = '';
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

    button?.focus();
    button?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(input);
  });
});
