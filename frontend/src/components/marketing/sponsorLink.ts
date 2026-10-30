function privateV4(a: number, b: number): boolean {
  if (a > 255 || b > 255) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function v4Pair(host: string): [number, number] | null {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
  const [a, b] = host.split('.').map(Number);
  return [a, b];
}

function mappedPrivate(rest: string): boolean {
  if (rest.includes(':')) {
    const [hi, lo] = rest.split(':');
    const hiN = Number.parseInt(hi, 16);
    const loN = Number.parseInt(lo || '', 16);
    if (!Number.isInteger(hiN) || !Number.isInteger(loN) || hiN < 0 || loN < 0 || hiN > 0xffff || loN > 0xffff) {
      return true;
    }
    const n = hiN * 65536 + loN;
    return privateV4(Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256);
  }
  const pair = v4Pair(rest);
  if (!pair) return true;
  return privateV4(pair[0], pair[1]);
}

function privateHost(host: string): boolean {
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
    if (host.startsWith('::ffff:')) return mappedPrivate(host.slice('::ffff:'.length));
    return false;
  }
  const pair = v4Pair(host);
  if (!pair) return false;
  return privateV4(pair[0], pair[1]);
}

export function linkProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return 'Informe um endereço https.';
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return 'Informe um endereço https.';
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return 'O endereço precisa ser https, sem usuário nem senha.';
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || privateHost(host)) {
    return 'Esse endereço não pode ser usado.';
  }
  return null;
}

export function contactProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (text.includes('@') || text.replace(/\D/g, '').length >= 8) {
    return 'O contato é só o nome. Não grave e-mail nem telefone.';
  }
  return null;
}

export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function daysUntil(fim: string, today: string): number {
  const [year, month, day] = fim.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export function brDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function percentLabel(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function countLabel(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}
