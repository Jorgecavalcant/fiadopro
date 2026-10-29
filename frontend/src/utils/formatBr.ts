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
