import { Router, Response, NextFunction, json } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { linkCustomer } from '../services/linking.js';

const router = Router();
// Importação carrega anexos em base64 — limite maior SÓ nesta rota
router.use(json({ limit: '50mb' }));
router.use(requireAuth);

const ImportCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().max(30).default(''),
  email: z.string().email().max(255).optional().nullable(),
  pixKey: z.string().max(140).optional().nullable(),
  trusted: z.boolean().optional(),
  overpaymentStrategy: z.enum(['PROFIT', 'RETURN']).optional(),
  notes: z.array(z.object({ id: z.string(), text: z.string().max(2000), createdAt: z.number() })).optional(),
  score: z.number().int().min(0).max(1000).optional().nullable(),
  createdAt: z.number().optional(),
});

const ImportTransactionSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  type: z.enum(['DEBT', 'PAYMENT', 'REFUND', 'ABATIMENTO']),
  amount: z.number().positive(),
  description: z.string().max(2000).default(''),
  timestamp: z.number(),
  dueDate: z.number().optional().nullable(),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'COMPENSATION']).optional().nullable(),
  attachment: z
    .object({ data: z.string().max(14 * 1024 * 1024), mimeType: z.string().max(100), name: z.string().max(255) })
    .optional()
    .nullable(),
  status: z.enum(['CONFIRMED', 'PENDING', 'REJECTED']).optional(),
  installmentNumber: z.number().int().positive().optional().nullable(),
  totalInstallments: z.number().int().positive().optional().nullable(),
  installmentGroupId: z.string().uuid().optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
});

const ImportSchema = z.object({
  customers: z.array(ImportCustomerSchema).max(5000).default([]),
  transactions: z.array(ImportTransactionSchema).max(20000).default([]),
});

/**
 * POST /api/sync/import — migração idempotente do estado localStorage.
 * Upsert por id (ON CONFLICT DO NOTHING): reimportar nunca duplica.
 * Histórico local importa como CONFIRMED (pré-datava o fluxo de aprovação).
 */
router.post('/import', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = ImportSchema.parse(req.body);
    const userId = req.user!.sub;
    let customersImported = 0;
    let transactionsImported = 0;

    for (const c of body.customers) {
      const r = await query(
        `INSERT INTO customers (id, owner_user_id, name, phone, email, pix_key, trusted, overpayment_strategy, notes, score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, 'RETURN'), COALESCE($9::jsonb, '[]'::jsonb), $10, COALESCE($11, NOW()))
         ON CONFLICT (id) DO NOTHING`,
        [c.id, userId, c.name, c.phone, c.email ?? null, c.pixKey ?? null, c.trusted ?? null,
         c.overpaymentStrategy ?? null, c.notes ? JSON.stringify(c.notes) : null, c.score ?? null,
         c.createdAt ? new Date(c.createdAt) : null]
      );
      customersImported += r.rowCount ?? 0;
    }

    const ownedIds = new Set<string>(
      (await query(`SELECT id FROM customers WHERE owner_user_id = $1`, [userId])).rows.map(
        (r: { id: string }) => r.id
      )
    );

    for (const t of body.transactions) {
      if (!ownedIds.has(t.customerId)) continue; // nunca importar contra cliente de outro dono
      const r = await query(
        `INSERT INTO transactions (id, customer_id, owner_user_id, type, status, amount, description,
                                   occurred_at, due_date, payment_method, attachment,
                                   installment_number, total_installments, installment_group_id, interest_rate)
         VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.customerId, userId, t.type, t.amount, t.description, new Date(t.timestamp),
         t.dueDate ? new Date(t.dueDate) : null, t.paymentMethod ?? null,
         t.attachment ? JSON.stringify(t.attachment) : null,
         t.installmentNumber ?? null, t.totalInstallments ?? null,
         t.installmentGroupId ?? null, t.interestRate ?? null]
      );
      transactionsImported += r.rowCount ?? 0;
    }

    // Vínculo dos clientes recém-importados (best-effort, não bloqueia a resposta)
    for (const c of body.customers) {
      try {
        await linkCustomer(c.id);
      } catch {
        /* revínculo posterior cobre */
      }
    }

    res.json({ success: true, customersImported, transactionsImported });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

export default router;
