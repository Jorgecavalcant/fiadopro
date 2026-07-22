// Cliente HTTP para a API do Asaas (v3) — fetch nativo, sem dependencias externas.
// IMPORTANTE: a chave de API (ASAAS_API_KEY) nunca deve ser logada ou incluida
// em mensagens de erro devolvidas ao cliente.

const DEFAULT_BASE_URL = 'https://api-sandbox.asaas.com/v3';

/** Lancada quando ASAAS_API_KEY nao esta configurada (staging roda sem Asaas). */
export class AsaasNotConfiguredError extends Error {
  constructor() {
    super('Pagamentos nao configurados');
    this.name = 'AsaasNotConfiguredError';
  }
}

/** Lancada para qualquer falha de comunicacao/negocio com o Asaas (mensagem ja amigavel). */
export class AsaasRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsaasRequestError';
  }
}

function getBaseUrl(): string {
  return process.env.ASAAS_BASE_URL || DEFAULT_BASE_URL;
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new AsaasNotConfiguredError();
  return key;
}

interface AsaasErrorBody {
  errors?: Array<{ code?: string; description?: string }>;
}

async function asaasFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const apiKey = getApiKey();

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method: init.method,
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    // Erro de rede/conexao — nunca expor detalhes internos nem a chave.
    throw new AsaasRequestError('Nao foi possivel conectar ao Asaas. Tente novamente em instantes.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = payload as AsaasErrorBody | null;
    const friendly = body?.errors?.[0]?.description;
    throw new AsaasRequestError(friendly || 'Erro ao comunicar com o Asaas. Tente novamente.');
  }

  return payload as T;
}

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
}

export interface AsaasCustomer {
  id: string;
  name?: string;
  email?: string;
  cpfCnpj?: string;
  [key: string]: unknown;
}

export async function createCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
    },
  });
}

export interface AsaasSubscriptionInput {
  customer: string;
  value: number;
  nextDueDate: string;
  description?: string;
}

export interface AsaasSubscription {
  id: string;
  status?: string;
  invoiceUrl?: string;
  [key: string]: unknown;
}

export async function createSubscription(input: AsaasSubscriptionInput): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: {
      customer: input.customer,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value: input.value,
      nextDueDate: input.nextDueDate,
      description: input.description || 'Fiado Pro - Plano PRO (mensal)',
    },
  });
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'GET',
  });
}

/**
 * Cancela a assinatura no Asaas (para as cobranças futuras). O acesso PRO já
 * pago continua valendo até current_period_end — quem decide isso é
 * getUserPlan() no banco local, não o Asaas.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch<unknown>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
  });
}
