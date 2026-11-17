import { useState, type FormEvent } from 'react';

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

  if (!open) return null;

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
    <div
      className="fp-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-signup-title"
    >
      <section className="fp-card">
        <h2 id="complete-signup-title">Complete seu cadastro</h2>
        <p>Para continuar, informe seu telefone com DDD.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-phone">Telefone</label>
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'signup-phone-error' : undefined}
          />
          {error && (
            <p id="signup-phone-error" role="alert">
              {error}
            </p>
          )}
          <button className="fp-button" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </section>
    </div>
  );
}
