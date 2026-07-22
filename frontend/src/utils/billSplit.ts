// Lógica pura de rateio de eventos (itens, participantes, divisão) — extraída do
// App.tsx (EventDetailView) para ser testável sem depender de React/DOM.
import type { BillItem } from '../types';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Quantidade do item. Itens legados (criados antes de quantity existir) caem no fallback = 1. */
export const getItemQuantity = (item: Pick<BillItem, 'quantity'>): number => item.quantity ?? 1;

/** Valor unitário do item. Itens legados (sem unitPrice) caem no fallback = price atual. */
export const getItemUnitPrice = (item: Pick<BillItem, 'unitPrice' | 'price'>): number =>
  item.unitPrice ?? item.price;

/**
 * price = quantity * unitPrice (arredondado a 2 casas) — fonte única de verdade do total do item.
 * Itens sem quantity/unitPrice (legados) recalculam para o mesmo price que já tinham
 * (quantity=1 * unitPrice=price), então nunca quebram dados existentes.
 */
export const computeItemPrice = (item: Pick<BillItem, 'quantity' | 'unitPrice' | 'price'>): number =>
  round2(getItemQuantity(item) * getItemUnitPrice(item));

export interface ParticipantShare {
  participantId: string;
  customerId: string;
  amount: number;
  description: string;
}

/** Registro já existente (Transaction ou Debt) vinculado a um evento. */
export interface ExistingLinkedRecord {
  id: string;
  customerId: string;
  eventId?: string;
}

export interface RecordUpdate {
  id: string;
  amount: number;
  description: string;
}

export interface RecordCreate {
  customerId: string;
  amount: number;
  description: string;
}

export interface SplitRecordsPlan {
  updates: RecordUpdate[];
  creates: RecordCreate[];
}

/**
 * Decide, para cada participante com valor calculado, se já existe um registro
 * (Transaction ou Debt) vinculado a este evento e a este cliente — nesse caso deve
 * ser ATUALIZADO (novo amount/description) — ou se deve ser CRIADO do zero.
 *
 * Evita duplicar transações/dívidas quando o usuário reconfirma a divisão de um
 * evento que já tinha sido confirmado antes (ver handleConfirmSplit em App.tsx).
 */
export function planEventSplitRecords(
  shares: ParticipantShare[],
  existingRecords: ExistingLinkedRecord[],
  eventId: string
): SplitRecordsPlan {
  const existingForEvent = existingRecords.filter(r => r.eventId === eventId);
  const updates: RecordUpdate[] = [];
  const creates: RecordCreate[] = [];

  shares.forEach(share => {
    const existing = existingForEvent.find(r => r.customerId === share.customerId);
    if (existing) {
      updates.push({ id: existing.id, amount: share.amount, description: share.description });
    } else {
      creates.push({ customerId: share.customerId, amount: share.amount, description: share.description });
    }
  });

  return { updates, creates };
}

/** Formata uma data como DD/MM/AAAA (2 dígitos em dia e mês). Default = agora. */
export function formatDateBR(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
