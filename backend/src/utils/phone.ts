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
