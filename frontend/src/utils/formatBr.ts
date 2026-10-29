const SAO_PAULO = 'America/Sao_Paulo';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Valor de um input type="date" (YYYY-MM-DD) vira timestamp.
 * Meio-dia em São Paulo, para o dia civil escolhido não virar na virada do UTC.
 * O que fica gravado continua sendo um número (timestamp), não o texto dd/mm/aaaa.
 * String vazia ou inválida devolve undefined: a dívida fica sem vencimento.
 */
export function brDateInputToTimestamp(isoDate: string): number | undefined {
  if (!DATE_ONLY.test(isoDate)) return undefined;
  const instant = new Date(`${isoDate}T12:00:00-03:00`).getTime();
  return Number.isFinite(instant) ? instant : undefined;
}

function toInstant(value: Date | number | string): Date {
  if (typeof value === 'string') {
    const calendar = brDateInputToTimestamp(value);
    if (calendar !== undefined) return new Date(calendar);
  }
  return value instanceof Date ? value : new Date(value);
}

function readParts(date: Date, withTime: boolean): Record<string, string> {
  const bag = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).formatToParts(date);
  const out: Record<string, string> = {};
  for (const item of bag) out[item.type] = item.value;
  return out;
}

/** dd/mm/aaaa no fuso America/Sao_Paulo. */
export function formatBrDate(value: Date | number | string): string {
  const date = toInstant(value);
  if (Number.isNaN(date.getTime())) return '';
  const piece = readParts(date, false);
  return `${piece.day}/${piece.month}/${piece.year}`;
}

/** dd/mm/aaaa HH:mm, hora de 24h, no fuso America/Sao_Paulo. */
export function formatBrDateTime(value: Date | number | string): string {
  const date = toInstant(value);
  if (Number.isNaN(date.getTime())) return '';
  const piece = readParts(date, true);
  return `${piece.day}/${piece.month}/${piece.year} ${piece.hour}:${piece.minute}`;
}

/** Timestamp gravado ao meio-dia de São Paulo volta para YYYY-MM-DD do dia civil. */
export function timestampToIsoDate(value: number): string {
  const text = formatBrDate(value);
  const [day, month, year] = text.split('/');
  if (!day || !month || !year) return '';
  return `${year}-${month}-${day}`;
}

/** Enquanto a pessoa digita, só entram dígitos no formato dd/mm/aaaa. */
export function maskBrDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

/**
 * dd/mm/aaaa completo vira YYYY-MM-DD.
 * Data impossível (31/02) devolve undefined, para não gravar outro dia.
 */
export function brDisplayToIso(text: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return undefined;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const stored = brDateInputToTimestamp(iso);
  if (stored === undefined || formatBrDate(stored) !== text) return undefined;
  return iso;
}

const MAX_CENTS_DIGITS = 13;

/**
 * Máscara de caixa: os dígitos são centavos, entram pela direita.
 * "1000000" e "1.234,56" e "1234,56" viram número (10000, 1234.56, 1234.56).
 * Vazio devolve null. O resultado é número, nunca o texto formatado.
 */
export function parseBrCurrencyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const cents = Number(digits.slice(0, MAX_CENTS_DIGITS));
  if (!Number.isSafeInteger(cents)) return null;
  return cents / 100;
}

/** R$ 1.000,00 — só visual. Zero e vazio ficam em branco. */
export function formatBrCurrencyInput(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value === 0) return '';
  const cents = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';
  return `${sign}R$ ${grouped},${frac}`;
}

export const AMOUNT_REQUIRED_MESSAGE = 'Informe um valor maior que zero';
export const DESCRIPTION_REQUIRED_MESSAGE = 'Informe uma descrição';

export function amountFieldMessage(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return AMOUNT_REQUIRED_MESSAGE;
  return '';
}

export function descriptionFieldMessage(value: string): string {
  return value.trim() ? '' : DESCRIPTION_REQUIRED_MESSAGE;
}
