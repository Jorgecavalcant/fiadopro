import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import FullScreenModal from './FullScreenModal';

type CompleteSignupGateProps = {
  open: boolean;
  onSaved: (phone: string) => void;
  onError?: (message: string) => void;
};

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function needsPhoneCompletion(
  user: { phone?: string | null } | null | undefined,
): boolean {
  if (!user?.phone) return true;
  const phone = normalizePhone(user.phone);
  return phone.length !== 10 && phone.length !== 11;
}

export function CompleteSignupGate({
  open,
  onSaved,
  onError,
}: CompleteSignupGateProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const appRoot = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
    const previousInert = appRoot?.inert ?? false;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = 'hidden';
    if (appRoot) {
      appRoot.setAttribute('aria-hidden', 'true');
      appRoot.inert = true;
    }
    phoneInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) {
        if (previousAriaHidden === null) {
          appRoot.removeAttribute('aria-hidden');
        } else {
          appRoot.setAttribute('aria-hidden', previousAriaHidden);
        }
        appRoot.inert = previousInert;
      }
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function keepFocusInDialog(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length !== 10 && normalizedPhone.length !== 11) {
      const message = 'Informe um telefone válido com DDD.';
      setError(message);
      onError?.(message);
      return;
    }

    setError('');
    setSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiUrl}/users/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (!response.ok) {
        throw new Error('Não foi possível salvar seu telefone. Tente novamente.');
      }

      onSaved(normalizedPhone);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível salvar seu telefone. Tente novamente.';
      setError(message);
      onError?.(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FullScreenModal>
      <div
        ref={dialogRef}
        className="fp-overlay z-[10000] overflow-y-auto p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-signup-title"
        onKeyDown={keepFocusInDialog}
      >
        <div className="flex min-h-full items-center justify-center">
          <section className="fp-modal w-full max-w-md rounded-t42md border border-[#EAEAE5] p-6 shadow-t42md sm:p-8">
            <div className="mb-6">
              <h2 id="complete-signup-title" className="text-base font-medium leading-snug text-slate-900 sm:text-lg">
                Falta pouco para começar
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500 sm:text-[15px]">
                Informe seu telefone com DDD para concluir o cadastro.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block" htmlFor="signup-phone">
                <span className="mb-2 block text-sm font-medium text-slate-900">Telefone</span>
                <input
                  ref={phoneInputRef}
                  id="signup-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  className="fp-input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'signup-phone-error' : undefined}
                />
              </label>
              {error && (
                <p id="signup-phone-error" className="text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              )}
              <button
                className="fp-btn fp-btn-primary fp-btn-block"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Concluir cadastro'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </FullScreenModal>
  );
}
