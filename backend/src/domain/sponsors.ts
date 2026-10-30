export type SponsorSlot = 'faixa' | 'tela_cheia';
export type SponsorPlan = 'free' | 'pro';
export type ContractStatus = 'rascunho' | 'ativo' | 'pausado' | 'vencido' | 'cancelado';
export type ContractAction = 'ativar' | 'pausar' | 'retomar' | 'cancelar' | 'vencer';
export type AppPlan = 'FREE' | 'PRO' | 'ENTERPRISE' | 'ADMIN';
export type Turno = 'manha' | 'tarde' | 'noite';

export class SponsorRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SponsorRuleError';
  }
}

const ZONE = 'America/Sao_Paulo';

export function saoPauloToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function saoPauloTurn(now: Date): Turno {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now);
  const hour = Number(raw) % 24;
  if (hour >= 6 && hour < 12) return 'manha';
  if (hour >= 12 && hour < 18) return 'tarde';
  return 'noite';
}

export function contractIsLive(input: {
  status: ContractStatus;
  inicio: string;
  fim: string;
  sponsorAtivo: boolean;
  creativeAtivo: boolean;
  today: string;
}): boolean {
  return (
    input.sponsorAtivo &&
    input.creativeAtivo &&
    input.status === 'ativo' &&
    input.inicio <= input.today &&
    input.fim >= input.today
  );
}

export function transitionContract(
  current: ContractStatus,
  action: ContractAction,
  fim: string,
  today: string,
): ContractStatus {
  if (action === 'vencer') {
    if (current === 'ativo' && fim < today) return 'vencido';
    return current;
  }
  if (current === 'vencido' || current === 'cancelado') {
    throw new SponsorRuleError('Contrato vencido ou cancelado não volta ao ar. Crie uma renovação.');
  }
  if (action === 'pausar') {
    if (current !== 'ativo') throw new SponsorRuleError('Só um contrato no ar pode ser pausado.');
    if (fim < today) return 'vencido';
    return 'pausado';
  }
  if (action === 'retomar') {
    if (current !== 'pausado') throw new SponsorRuleError('Só um contrato pausado pode ser retomado.');
    if (fim < today) return 'vencido';
    return 'ativo';
  }
  if (action === 'ativar') {
    if (current !== 'rascunho') throw new SponsorRuleError('Só um rascunho pode ser ativado.');
    if (fim < today) throw new SponsorRuleError('A data final já passou.');
    return 'ativo';
  }
  if (action === 'cancelar') return 'cancelado';
  throw new SponsorRuleError('Ação inválida.');
}

export function planRenewal(
  oldStatus: ContractStatus,
  nextInicio: string,
  nextFim: string,
  today: string,
): 'ativo' | 'rascunho' {
  if (oldStatus !== 'vencido') {
    throw new SponsorRuleError('Só um contrato vencido pode ser renovado.');
  }
  if (nextFim < nextInicio) {
    throw new SponsorRuleError('A data final não pode ser antes do início.');
  }
  if (nextFim < today) throw new SponsorRuleError('A data final já passou.');
  return nextInicio <= today ? 'ativo' : 'rascunho';
}

/** Plano desconhecido: no máximo a faixa. Enterprise e admin não veem anúncio. Pro não vê tela cheia. */
export function decideSlot(
  plan: AppPlan,
  confirmed: boolean,
  requested: SponsorSlot,
): SponsorSlot | null {
  if (requested === 'tela_cheia') {
    if (!confirmed || plan !== 'FREE') return null;
    return 'tela_cheia';
  }
  if (!confirmed) return 'faixa';
  if (plan === 'FREE' || plan === 'PRO') return 'faixa';
  return null;
}

export function metricPlan(plan: AppPlan, confirmed: boolean): SponsorPlan | null {
  if (!confirmed) return null;
  if (plan === 'FREE') return 'free';
  if (plan === 'PRO') return 'pro';
  return null;
}

export function pickCreative<T extends { id: string; ordem: number; exibicoesHoje: number }>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  return [...items].sort(
    (a, b) => a.exibicoesHoje - b.exibicoesHoje || a.ordem - b.ordem || a.id.localeCompare(b.id),
  )[0];
}

export function eventAllowed(input: {
  live: boolean;
  slot: SponsorSlot;
  plan: AppPlan;
  confirmed: boolean;
  fullscreenDelivered: boolean;
}): boolean {
  if (!input.live || metricPlan(input.plan, input.confirmed) === null) return false;
  if (decideSlot(input.plan, input.confirmed, input.slot) !== input.slot) return false;
  if (input.slot === 'tela_cheia' && !input.fullscreenDelivered) return false;
  return true;
}

export type PublicCreative = {
  id: string;
  tipo: 'imagem' | 'video';
  media_url: string;
  link_destino: string;
  titulo: string;
  texto_alt: string;
  patrocinador: string;
};

export function toPublicCreative(row: PublicCreative & Record<string, unknown>): PublicCreative {
  return {
    id: row.id,
    tipo: row.tipo,
    media_url: row.media_url,
    link_destino: row.link_destino,
    titulo: row.titulo,
    texto_alt: row.texto_alt,
    patrocinador: row.patrocinador,
  };
}

const PRIVATE_V4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function assertPublicHttps(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SponsorRuleError('Informe um endereço https.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new SponsorRuleError('O endereço precisa ser https, sem usuário nem senha.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    isPrivateHost(host)
  ) {
    throw new SponsorRuleError('Esse endereço não pode ser usado.');
  }
  return url.toString();
}

function isPrivateHost(host: string): boolean {
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return true;
  }
  if (!PRIVATE_V4.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if ([a, b].some((part) => part > 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function cleanText(value: string, max: number, label: string): string {
  const text = [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return char !== '<' && char !== '>' && code > 31 && code !== 127;
    })
    .join('')
    .trim();
  if (!text) throw new SponsorRuleError(`Informe ${label}.`);
  if (text.length > max) throw new SponsorRuleError(`${label} passa de ${max} caracteres.`);
  return text;
}

export function cleanOptionalName(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const text = cleanText(value, 80, 'o nome do contato');
  const digits = text.replace(/\D/g, '');
  if (text.includes('@') || digits.length >= 8) {
    throw new SponsorRuleError('O contato é só o nome. Não grave e-mail nem telefone.');
  }
  return text;
}

export function consumeRate(
  store: Map<string, { n: number; reset: number }>,
  key: string,
  now: number,
  max: number,
  windowMs: number,
): boolean {
  const current = store.get(key);
  if (!current || current.reset <= now) {
    store.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (current.n >= max) return false;
  current.n += 1;
  return true;
}
