import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query, getClient } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  createCustomer,
  createSubscription,
  getSubscription,
  cancelSubscription,
  AsaasNotConfiguredError,
  AsaasRequestError,
} from '../services/asaas.js';
import {
  adPolicyFor,
  getUserPlan,
  maxReportMonths,
  PRO_MONTHLY_PRICE,
  publicPlanPrices,
} from '../services/plans.js';

const router = Router();

const PRO_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const FREE_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'SUBSCRIPTION_DELETED']);
const PRO_PERIOD_DAYS = 32;

const SubscribeSchema = z.object({
  cpf: z.string().min(11).max(18).optional(),
});

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpfCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

/**
 * Classifica um evento de webhook do Asaas em uma transicao de plano.
 * Retorna null para eventos que nao afetam o plano (ignorados com 200 rapido).
 */
export function classifyBillingEvent(event: string): 'ACTIVATE' | 'DEACTIVATE' | null {
  if (PRO_EVENTS.has(event)) return 'ACTIVATE';
  if (FREE_EVENTS.has(event)) return 'DEACTIVATE';
  return null;
}

/** Compara em tempo constante, mesmo com tamanhos diferentes (nao vaza tamanho via timing). */
export function timingSafeEqualString(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    // Ainda assim gasta o tempo de uma comparacao, para nao vazar tamanho via timing.
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// GET /api/billing/status
export async function getStatusHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const plan = await getUserPlan(userId);
    const result = await query(
      'SELECT plan, status, current_period_end, canceled_at, asaas_subscription_id FROM subscriptions WHERE user_id = $1',
      [userId],
    );
    const sub = result.rows[0] || null;

    res.json({
      success: true,
      plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      canceledAt: sub?.canceled_at ?? null,
      canCancel: Boolean(sub?.asaas_subscription_id) && !sub?.canceled_at,
      maxReportMonths: maxReportMonths(plan),
      prices: publicPlanPrices(),
      adPolicy: adPolicyFor(plan),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/billing/subscribe
export async function subscribeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const body = SubscribeSchema.parse(req.body ?? {});

    const userResult = await query(
      'SELECT id, full_name, email, cpf FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) return next(new ApiError(404, 'Usuario nao encontrado', 'USER_NOT_FOUND'));

    const rawCpf = user.cpf || body.cpf || '';
    if (!rawCpf) {
      return next(new ApiError(400, 'Informe seu CPF para assinar o plano PRO', 'CPF_REQUIRED'));
    }
    if (!isValidCpfCnpj(rawCpf)) {
      return next(new ApiError(400, 'CPF/CNPJ invalido', 'INVALID_CPF'));
    }
    const cpfCnpj = onlyDigits(rawCpf);

    if (!user.cpf) {
      await query('UPDATE users SET cpf = $1, updated_at = NOW() WHERE id = $2', [cpfCnpj, userId]);
    }

    const customer = await createCustomer({
      name: user.full_name || user.email,
      email: user.email,
      cpfCnpj,
    });

    const price = PRO_MONTHLY_PRICE;
    const nextDueDate = new Date().toISOString().slice(0, 10);

    const subscription = await createSubscription({
      customer: customer.id,
      value: price,
      nextDueDate,
    });

    const detail = await getSubscription(subscription.id);
    const invoiceUrl = detail.invoiceUrl || subscription.invoiceUrl || null;
    const status = detail.status || subscription.status || 'PENDING';

    const existing = await query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE subscriptions
            SET asaas_customer_id = $1, asaas_subscription_id = $2, status = $3, updated_at = NOW()
          WHERE user_id = $4`,
        [customer.id, subscription.id, status, userId],
      );
    } else {
      await query(
        `INSERT INTO subscriptions (user_id, plan, asaas_customer_id, asaas_subscription_id, status)
         VALUES ($1, 'FREE', $2, $3, $4)`,
        [userId, customer.id, subscription.id, status],
      );
    }

    res.json({ success: true, invoiceUrl, status });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    if (err instanceof AsaasNotConfiguredError) {
      return next(new ApiError(503, 'Pagamentos nao configurados', 'BILLING_NOT_CONFIGURED'));
    }
    if (err instanceof AsaasRequestError)
      return next(new ApiError(502, err.message, 'ASAAS_ERROR'));
    next(err);
  }
}

// POST /api/billing/cancel — cancela a assinatura (mantém acesso PRO até
// current_period_end; não é o mesmo que downgrade imediato)
export async function cancelHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const result = await query(
      'SELECT asaas_subscription_id, current_period_end, canceled_at FROM subscriptions WHERE user_id = $1',
      [userId],
    );
    const sub = result.rows[0];
    if (!sub || !sub.asaas_subscription_id) {
      return next(new ApiError(404, 'Nenhuma assinatura ativa para cancelar', 'NO_SUBSCRIPTION'));
    }
    if (sub.canceled_at) {
      // Idempotente: já cancelada, apenas devolve o estado atual.
      return res.json({ success: true, currentPeriodEnd: sub.current_period_end });
    }

    await cancelSubscription(sub.asaas_subscription_id);

    await query(
      `UPDATE subscriptions SET canceled_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
      [userId],
    );

    res.json({ success: true, currentPeriodEnd: sub.current_period_end });
  } catch (err) {
    if (err instanceof AsaasNotConfiguredError) {
      return next(new ApiError(503, 'Pagamentos nao configurados', 'BILLING_NOT_CONFIGURED'));
    }
    if (err instanceof AsaasRequestError)
      return next(new ApiError(502, err.message, 'ASAAS_ERROR'));
    next(err);
  }
}

type SqlRunner = (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

/** Aplica a mudança do plano. Não mexe em concessão (cortesia, teste, cupom). */
async function applyBillingTransition(
  sql: SqlRunner,
  event: string,
  transition: 'ACTIVATE' | 'DEACTIVATE',
  subscriptionId: string,
) {
  if (transition === 'ACTIVATE') {
    const periodEnd = new Date(Date.now() + PRO_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    await sql(
      `UPDATE subscriptions
          SET plan = 'PRO', status = 'active', current_period_end = $1, updated_at = NOW()
        WHERE asaas_subscription_id = $2`,
      [periodEnd, subscriptionId],
    );
    return;
  }
  if (event === 'PAYMENT_OVERDUE') {
    await sql(
      `UPDATE subscriptions
          SET plan = 'FREE', status = 'overdue', updated_at = NOW()
        WHERE asaas_subscription_id = $1
          AND (current_period_end IS NULL OR current_period_end <= NOW())`,
      [subscriptionId],
    );
    return;
  }
  const status = event === 'SUBSCRIPTION_DELETED' ? 'canceled' : 'refunded';
  await sql(
    `UPDATE subscriptions
        SET plan = 'FREE', status = $1, updated_at = NOW()
      WHERE asaas_subscription_id = $2`,
    [status, subscriptionId],
  );
}

// POST /api/billing/webhook/asaas — sem auth de usuário (token do provedor).
async function recordWebhook(
  eventId: string,
  event: string,
  transition: 'ACTIVATE' | 'DEACTIVATE',
  subscriptionId: string,
): Promise<'duplicate' | 'applied'> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO billing_webhook_events (provider, event_id, event_name)
       VALUES ('asaas', $1, $2)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, event],
    );
    if (inserted.rows.length === 0) {
      await client.query('COMMIT');
      return 'duplicate';
    }
    await applyBillingTransition(client.query.bind(client), event, transition, subscriptionId);
    await client.query('COMMIT');
    return 'applied';
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* a transação já foi desfeita ou nem abriu */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function webhookHandler(req: Request, res: Response) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    console.error('[Billing] ASAAS_WEBHOOK_TOKEN nao configurado — webhook recusado');
    return res.status(503).json({ success: false, message: 'Webhook nao configurado' });
  }

  const headerValue = req.headers['asaas-access-token'];
  const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!timingSafeEqualString(provided, expected)) {
    return res.status(401).json({ success: false, message: 'Token invalido' });
  }

  const event = typeof req.body?.event === 'string' ? req.body.event : '';
  const subscriptionId = req.body?.payment?.subscription as string | undefined;
  const transition = event ? classifyBillingEvent(event) : null;
  if (!transition || !subscriptionId) {
    return res.status(200).json({ success: true });
  }

  const paymentId = typeof req.body?.payment?.id === 'string' ? req.body.payment.id : '';
  const rawId = typeof req.body?.id === 'string' ? req.body.id : '';
  const eventId = rawId || `${event}:${paymentId || subscriptionId}`;
  try {
    const outcome = await recordWebhook(eventId, event, transition, subscriptionId);
    return res.status(200).json({ success: true, duplicate: outcome === 'duplicate' });
  } catch {
    console.error('[Billing] Erro ao processar webhook. O provedor pode tentar de novo.');
    return res.status(500).json({ success: false });
  }
}

router.get('/status', requireAuth, getStatusHandler);
router.post('/subscribe', requireAuth, subscribeHandler);
router.post('/cancel', requireAuth, cancelHandler);
router.post('/webhook/asaas', webhookHandler);

export default router;
