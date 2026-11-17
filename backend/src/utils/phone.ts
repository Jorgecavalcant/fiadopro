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

export const PHONE_INVALID_MESSAGE = 'Informe um celular com DDD, 10 ou 11 dígitos';

export function isValidNormalizedPhone(normalized: string): boolean {
  return normalized.length === 10 || normalized.length === 11;
}

/** Valida telefone informado. String vazia após normalizar retorna '' (caller decide se exige valor). */
export function validatePhoneInput(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  if (normalized === '') return '';
  if (!isValidNormalizedPhone(normalized)) {
    throw new Error(PHONE_INVALID_MESSAGE);
  }
  return normalized;
}

/**
 * Equivalência móvel do 9º dígito: DDD+9+8 (11) ↔ DDD+8 (10), mesmo DDD e mesmos 8 finais.
 * Não iguala dois 11 nem dois 10 distintos. Risco residual fixo↔móvel existe se um 10
 * coincidir com os 8 finais de um móvel com 9 — aceito só nesta regra documentada.
 */
export function phonesMatchMobile9th(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length !== 10 || long.length !== 11) return false;
  if (long[2] !== '9') return false;
  return short.slice(0, 2) === long.slice(0, 2) && short.slice(2) === long.slice(3);
}

/** Variantes para lookup SQL (próprio + forma com/sem 9º dígito). */
export function phoneMatchVariants(normalized: string): string[] {
  if (!normalized) return [];
  const out = new Set<string>([normalized]);
  if (normalized.length === 11 && normalized[2] === '9') {
    out.add(normalized.slice(0, 2) + normalized.slice(3));
  } else if (normalized.length === 10) {
    out.add(normalized.slice(0, 2) + '9' + normalized.slice(2));
  }
  return [...out];
}
