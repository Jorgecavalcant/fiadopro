import { Customer, Transaction } from '../types';

/**
 * Sincronização servidor↔localStorage.
 * Logado: servidor é a fonte de verdade; localStorage segue como cache
 * offline (o App continua persistindo tudo lá). Deslogado: nada muda.
 *
 * Modelo: pull inicial (com migração única do legado) + push por diff
 * (novos/alterados) com debounce. IDs são UUIDs gerados no cliente, e o
 * backend faz upsert idempotente — reenviar nunca duplica.
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';
const MIGRATED_FLAG = 'fiado_pro_migrated_v1';
const PUSH_DEBOUNCE_MS = 4000;

interface ServerCustomer {
  id: string;
  linked_user_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  pix_key: string | null;
  trusted: boolean;
  overpayment_strategy: 'PROFIT' | 'RETURN';
  notes: Customer['notes'];
  score: number | null;
  created_at: string;
  pending_count?: string | number;
}

interface ServerTransaction {
  id: string;
  customer_id: string;
  type: Transaction['type'];
  status: Transaction['status'];
  amount: string | number;
  description: string;
  occurred_at: string;
  due_date: string | null;
  payment_method: Transaction['paymentMethod'] | null;
  attachment: Transaction['attachment'] | null;
  installment_number: number | null;
  total_installments: number | null;
  installment_group_id: string | null;
  interest_rate: number | null;
}

export interface InboxItem {
  id: string;
  type: Transaction['type'];
  amount: string | number;
  description: string;
  occurred_at: string;
  due_date: string | null;
  created_at: string;
  customer_name: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string | null;
}

export interface Counterpart {
  owner_id: string;
  owner_name: string;
  owner_phone: string | null;
  owner_pix_key: string | null;
  customer_id: string;
  balance: string | number;
  pending_count: string | number;
  confirmed_count: string | number;
  last_activity: string | null;
}

const jsonFetch = async (path: string, init?: RequestInit): Promise<Record<string, unknown> | null> => {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data?.success === false) return null;
    return data;
  } catch {
    return null; // offline/erro de rede → chamador degrada para o cache local
  }
};

const toClientCustomer = (s: ServerCustomer, local?: Customer): Customer => ({
  ...(local ?? {}),
  id: s.id,
  name: s.name,
  phone: s.phone,
  email: s.email ?? undefined,
  pixKey: s.pix_key ?? undefined,
  trusted: s.trusted,
  overpaymentStrategy: s.overpayment_strategy,
  notes: s.notes ?? local?.notes ?? [],
  score: s.score ?? local?.score,
  createdAt: local?.createdAt ?? new Date(s.created_at).getTime(),
});

const toClientTransaction = (s: ServerTransaction, local?: Transaction): Transaction => ({
  ...(local ?? {}),
  id: s.id,
  customerId: s.customer_id,
  type: s.type,
  status: s.status,
  amount: Number(s.amount),
  description: s.description,
  timestamp: local?.timestamp ?? new Date(s.occurred_at).getTime(),
  dueDate: s.due_date ? new Date(s.due_date).getTime() : local?.dueDate,
  paymentMethod: s.payment_method ?? local?.paymentMethod,
  attachment: s.attachment ?? local?.attachment,
  installmentNumber: s.installment_number ?? local?.installmentNumber,
  totalInstallments: s.total_installments ?? local?.totalInstallments,
  installmentGroupId: s.installment_group_id ?? local?.installmentGroupId,
  interestRate: s.interest_rate ?? local?.interestRate,
  // eventId e fromUserId são conceitos locais — preservados do cache
  eventId: local?.eventId,
  fromUserId: local?.fromUserId,
});

const toServerTransactionBody = (t: Transaction) => ({
  id: t.id,
  customer_id: t.customerId,
  type: t.type,
  amount: t.amount,
  description: t.description ?? '',
  occurred_at: t.timestamp,
  due_date: t.dueDate ?? null,
  payment_method: t.paymentMethod ?? null,
  attachment: t.attachment ?? null,
  installment_number: t.installmentNumber ?? null,
  total_installments: t.totalInstallments ?? null,
  installment_group_id: t.installmentGroupId ?? null,
  interest_rate: t.interestRate ?? null,
});

const toServerCustomerBody = (c: Customer) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email || null,
  pix_key: c.pixKey || null,
  trusted: c.trusted ?? false,
  overpayment_strategy: c.overpaymentStrategy ?? 'RETURN',
  notes: c.notes ?? [],
  score: typeof c.score === 'number' ? Math.round(c.score) : null,
});

/** Estado da última sincronização — base do diff do push. */
let shadowCustomers = new Map<string, string>();
let shadowTransactions = new Map<string, string>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

const fingerprintCustomer = (c: Customer): string =>
  JSON.stringify(toServerCustomerBody(c));
const fingerprintTransaction = (t: Transaction): string =>
  JSON.stringify(toServerTransactionBody(t));

export interface BootstrapResult {
  customers: Customer[];
  transactions: Transaction[];
  online: boolean;
}

/**
 * Pull inicial pós-login. Migra o legado local uma única vez e devolve o
 * estado do servidor mesclado com campos exclusivamente locais.
 */
export async function bootstrapSync(
  localCustomers: Customer[],
  localTransactions: Transaction[]
): Promise<BootstrapResult> {
  // 1. Migração única do estado local pré-servidor
  if (!localStorage.getItem(MIGRATED_FLAG) && (localCustomers.length > 0 || localTransactions.length > 0)) {
    const imported = await jsonFetch('/sync/import', {
      method: 'POST',
      body: JSON.stringify({
        customers: localCustomers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || null,
          pixKey: c.pixKey || null,
          trusted: c.trusted,
          overpaymentStrategy: c.overpaymentStrategy,
          notes: c.notes,
          score: typeof c.score === 'number' ? Math.round(c.score) : null,
          createdAt: c.createdAt,
        })),
        transactions: localTransactions.map((t) => ({
          id: t.id,
          customerId: t.customerId,
          type: t.type,
          amount: t.amount,
          description: t.description ?? '',
          timestamp: t.timestamp,
          dueDate: t.dueDate ?? null,
          paymentMethod: t.paymentMethod ?? null,
          attachment: t.attachment ?? null,
          installmentNumber: t.installmentNumber ?? null,
          totalInstallments: t.totalInstallments ?? null,
          installmentGroupId: t.installmentGroupId ?? null,
          interestRate: t.interestRate ?? null,
        })),
      }),
    });
    if (imported) localStorage.setItem(MIGRATED_FLAG, '1');
  }

  // 2. Pull do servidor (fonte de verdade)
  const [customersData, transactionsData] = await Promise.all([
    jsonFetch('/customers'),
    jsonFetch('/transactions'),
  ]);
  if (!customersData || !transactionsData) {
    return { customers: localCustomers, transactions: localTransactions, online: false };
  }

  const localCustomerById = new Map(localCustomers.map((c) => [c.id, c]));
  const localTransactionById = new Map(localTransactions.map((t) => [t.id, t]));

  const customers = (customersData.customers as ServerCustomer[]).map((s) =>
    toClientCustomer(s, localCustomerById.get(s.id))
  );
  const transactions = (transactionsData.transactions as ServerTransaction[]).map((s) =>
    toClientTransaction(s, localTransactionById.get(s.id))
  );

  // 3. Registrar shadow para o diff do push
  shadowCustomers = new Map(customers.map((c) => [c.id, fingerprintCustomer(c)]));
  shadowTransactions = new Map(transactions.map((t) => [t.id, fingerprintTransaction(t)]));

  return { customers, transactions, online: true };
}

export type StatusPatch = { id: string; status: Transaction['status'] };

/**
 * Push por diff (debounced). Cria/atualiza no servidor o que mudou
 * localmente; devolve via callback os status decididos pelo servidor
 * (ex.: lançamento contra cliente vinculado volta como PENDING).
 */
export function schedulePush(
  loggedIn: boolean,
  customers: Customer[],
  transactions: Transaction[],
  onStatusFromServer: (patches: StatusPatch[]) => void
): void {
  if (!loggedIn) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushDiffs(customers, transactions, onStatusFromServer);
  }, PUSH_DEBOUNCE_MS);
}

async function pushDiffs(
  customers: Customer[],
  transactions: Transaction[],
  onStatusFromServer: (patches: StatusPatch[]) => void
): Promise<void> {
  const patches: StatusPatch[] = [];

  for (const c of customers) {
    const fp = fingerprintCustomer(c);
    const known = shadowCustomers.get(c.id);
    if (known === fp) continue;
    const body = toServerCustomerBody(c);
    const result = known === undefined
      ? await jsonFetch('/customers', { method: 'POST', body: JSON.stringify(body) })
      : await jsonFetch(`/customers/${c.id}`, { method: 'PATCH', body: JSON.stringify({ ...body, id: undefined }) });
    if (result) shadowCustomers.set(c.id, fp);
  }

  // Clientes apagados localmente → soft delete no servidor
  const liveCustomerIds = new Set(customers.map((c) => c.id));
  for (const id of Array.from(shadowCustomers.keys())) {
    if (!liveCustomerIds.has(id)) {
      const result = await jsonFetch(`/customers/${id}`, { method: 'DELETE' });
      if (result) shadowCustomers.delete(id);
    }
  }

  for (const t of transactions) {
    const fp = fingerprintTransaction(t);
    const known = shadowTransactions.get(t.id);
    if (known === fp) continue;
    const body = toServerTransactionBody(t);
    const result = known === undefined
      ? await jsonFetch('/transactions', { method: 'POST', body: JSON.stringify(body) })
      : await jsonFetch(`/transactions/${t.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...body, id: undefined, customer_id: undefined }),
        });
    if (result) {
      shadowTransactions.set(t.id, fp);
      const serverTx = result.transaction as ServerTransaction | undefined;
      if (serverTx && serverTx.status !== t.status) {
        patches.push({ id: t.id, status: serverTx.status });
        // Registrar o fingerprint do estado COM o status do servidor para não re-empurrar
        shadowTransactions.set(t.id, fingerprintTransaction({ ...t, status: serverTx.status }));
      }
    }
  }

  const liveTransactionIds = new Set(transactions.map((t) => t.id));
  for (const id of Array.from(shadowTransactions.keys())) {
    if (!liveTransactionIds.has(id)) {
      const result = await jsonFetch(`/transactions/${id}`, { method: 'DELETE' });
      if (result) shadowTransactions.delete(id);
    }
  }

  if (patches.length > 0) onStatusFromServer(patches);
}

/** Zera o estado de sync (logout). */
export function resetSyncState(): void {
  shadowCustomers = new Map();
  shadowTransactions = new Map();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}

// ===== Inbox / Contraparte / Ações de aprovação =====

export async function fetchInbox(): Promise<InboxItem[]> {
  const data = await jsonFetch('/inbox');
  return data ? (data.items as InboxItem[]) : [];
}

export async function fetchCounterparts(): Promise<Counterpart[]> {
  const data = await jsonFetch('/counterpart');
  return data ? (data.counterparts as Counterpart[]) : [];
}

export async function approveTransaction(id: string, note?: string): Promise<boolean> {
  return (await jsonFetch(`/transactions/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) })) !== null;
}

export async function rejectTransaction(id: string, note?: string): Promise<boolean> {
  return (await jsonFetch(`/transactions/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) })) !== null;
}

export async function resendTransaction(id: string): Promise<boolean> {
  return (await jsonFetch(`/transactions/${id}/resend`, { method: 'POST', body: JSON.stringify({}) })) !== null;
}

export interface ProfileUpdateInput {
  full_name?: string;
  phone?: string | null;
  pix_key?: string | null;
}

/**
 * Persiste nome/telefone/pix do próprio usuário no servidor. Sem isso,
 * users.phone/email nunca refletem o perfil real e o vínculo cliente↔usuário
 * (linkCustomer) nunca encontra correspondência — mesmo que outra pessoa
 * cadastre você certinho pelo telefone.
 */
export async function updateProfile(input: ProfileUpdateInput): Promise<boolean> {
  return (await jsonFetch('/users/me', { method: 'PATCH', body: JSON.stringify(input) })) !== null;
}
