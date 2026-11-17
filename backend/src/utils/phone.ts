/**
 * Normalização de telefone brasileiro para comparação/vínculo.
 * Espelha fn_norm_phone(raw) da migration 003 — manter os dois em sincronia.
 */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits === '') return '';
  const semDdi = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  return semDdi.replace(/^0+/, '');
}

export function isValidBrPhone(raw: string | null | undefined): boolean {
  const length = normalizePhone(raw).length;
  return length === 10 || length === 11;
}

export function assertValidBrPhoneOrEmpty(
  raw: string | null | undefined,
):
  | { ok: true; normalized: string }
  | { ok: false; message: string } {
  if (raw == null || raw.trim() === '') {
    return { ok: true, normalized: '' };
  }

  if (!isValidBrPhone(raw)) {
    return {
      ok: false,
      message: 'Informe um telefone brasileiro válido com DDD (10 ou 11 dígitos).',
    };
  }

  return { ok: true, normalized: normalizePhone(raw) };
}
