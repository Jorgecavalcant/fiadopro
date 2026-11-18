import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    phoneInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function keepFocusInDialog(event: React.KeyboardEvent<HTMLDivElement>) {
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
        className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-signup-title"
        onKeyDown={keepFocusInDialog}
      >
        <div className="flex min-h-full items-center justify-center">
          <section className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-950/30">
            <div className="bg-[#2B2F77] px-6 pb-7 pt-8 text-white sm:px-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Phone size={24} strokeWidth={2} aria-hidden="true" />
              </div>
              <h2 id="complete-signup-title" className="text-2xl font-semibold tracking-tight">
                Falta pouco para começar
              </h2>
              <p className="mt-2 text-sm leading-6 text-indigo-100">
                Informe seu telefone com DDD para deixar seu cadastro completo e seguro.
              </p>
            </div>

            <form className="space-y-5 px-6 py-7 sm:px-8" onSubmit={handleSubmit}>
              <label className="block" htmlFor="signup-phone">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Telefone</span>
                <input
                  ref={phoneInputRef}
                  id="signup-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2B2F77] focus:bg-white focus:ring-4 focus:ring-indigo-100"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2B2F77] px-4 py-3.5 text-base font-semibold text-white transition hover:bg-[#22265f] disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={saving}
              >
                <ShieldCheck size={19} aria-hidden="true" />
                {saving ? 'Salvando...' : 'Concluir cadastro'}
              </button>
              <p className="text-center text-xs leading-5 text-slate-500">
                Usamos seu telefone apenas para completar sua conta e facilitar seu atendimento.
              </p>
            </form>
          </section>
        </div>
      </div>
    </FullScreenModal>
  );
}
