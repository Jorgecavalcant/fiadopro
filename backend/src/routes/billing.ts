import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  createCustomer,
  createSubscription,
  getSubscription,
  AsaasNotConfiguredError,
  AsaasRequestError,
} from '../services/asaas.js';
import { getUserPlan, maxReportMonths } from '../services/plans.js';

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
export function timingSafeEqualString(provided: string | undefined, expected: string | undefined): boolean {
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
      'SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    const sub = result.rows[0] || null;

    res.json({
      success: true,
      plan,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      maxReportMonths: maxReportMonths(plan),
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
      [userId]
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

    const price = Number(process.env.ASAAS_PRO_PRICE || '19.90');
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
        [customer.id, subscription.id, status, userId]
      );
    } else {
      await query(
        `INSERT INTO subscriptions (user_id, plan, asaas_customer_id, asaas_subscription_id, status)
         VALUES ($1, 'FREE', $2, $3, $4)`,
        [userId, customer.id, subscription.id, status]
      );
    }

    res.json({ success: true, invoiceUrl, status });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    if (err instanceof AsaasNotConfiguredError) {
      return next(new ApiError(503, 'Pagamentos nao configurados', 'BILLING_NOT_CONFIGURED'));
    }
    if (err instanceof AsaasRequestError) return next(new ApiError(502, err.message, 'ASAAS_ERROR'));
    next(err);
  }
}

// POST /api/billing/webhook/asaas — sem auth (validado por token proprio do Asaas)
export async function webhookHandler(req: Request, res: Response) {
  try {
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

    const event = req.body?.event as string | undefined;
    const subscriptionId: string | undefined = req.body?.payment?.subscription;
    const transition = event ? classifyBillingEvent(event) : null;

    if (!transition || !subscriptionId) {
      // Evento que nao afeta plano (ou sem assinatura vinculada) — 200 rapido, sem processar.
      return res.status(200).json({ success: true });
    }

    if (transition === 'ACTIVATE') {
      const periodEnd = new Date(Date.now() + PRO_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await query(
        `UPDATE subscriptions
            SET plan = 'PRO', status = 'active', current_period_end = $1, updated_at = NOW()
          WHERE asaas_subscription_id = $2`,
        [periodEnd, subscriptionId]
      );
    } else {
      const status =
        event === 'PAYMENT_OVERDUE' ? 'overdue' : event === 'SUBSCRIPTION_DELETED' ? 'canceled' : 'refunded';
      await query(
        `UPDATE subscriptions
            SET plan = 'FREE', status = $1, updated_at = NOW()
          WHERE asaas_subscription_id = $2`,
        [status, subscriptionId]
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    // Nunca deixar o Asaas re-tentar em loop por falha nossa: loga e responde 200.
    console.error('[Billing] Erro ao processar webhook Asaas:', err);
    res.status(200).json({ success: true });
  }
}

router.get('/status', requireAuth, getStatusHandler);
router.post('/subscribe', requireAuth, subscribeHandler);
router.post('/webhook/asaas', webhookHandler);

export default router;
