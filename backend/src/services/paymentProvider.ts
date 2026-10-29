// Interface única de pagamento. O token do webhook não entra em log.
import crypto from 'crypto';
import {
  cancelSubscription as cancelAsaasSubscription,
  createCustomer as createAsaasCustomer,
  createSubscription as createAsaasSubscription,
  getSubscription as readAsaasSubscription,
} from './asaas.js';

export { AsaasNotConfiguredError, AsaasRequestError } from './asaas.js';

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
}

export interface PaymentCustomer {
  id: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  value: number;
  nextDueDate: string;
  description?: string;
}

export interface PaymentSubscription {
  id: string;
  status?: string;
  invoiceUrl?: string;
}

export type WebhookCheck = { ok: true } | { ok: false; httpStatus: 401 | 503 };

export interface PaymentProvider {
  createCustomer(input: CreateCustomerInput): Promise<PaymentCustomer>;
  createSubscription(input: CreateSubscriptionInput): Promise<PaymentSubscription>;
  readSubscription(subscriptionId: string): Promise<PaymentSubscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  verifyWebhook(providedHeader: string | undefined): WebhookCheck;
}

/** Compara em tempo constante. Tamanhos diferentes não lançam e não vazam o tamanho. */
function timingSafeEqualString(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

const asaasProvider: PaymentProvider = {
  createCustomer(input) {
    return createAsaasCustomer(input);
  },
  createSubscription(input) {
    return createAsaasSubscription({
      customer: input.customerId,
      value: input.value,
      nextDueDate: input.nextDueDate,
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
  },
  readSubscription(subscriptionId) {
    return readAsaasSubscription(subscriptionId);
  },
  cancelSubscription(subscriptionId) {
    return cancelAsaasSubscription(subscriptionId);
  },
  verifyWebhook(providedHeader) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected) return { ok: false, httpStatus: 503 };
    if (!timingSafeEqualString(providedHeader, expected)) {
      return { ok: false, httpStatus: 401 };
    }
    return { ok: true };
  },
};

export function getPaymentProvider(): PaymentProvider {
  // Outro provedor entra aqui depois.
  return asaasProvider;
}
