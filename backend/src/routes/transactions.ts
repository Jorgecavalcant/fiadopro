import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

// Base64 de 10MB ≈ 13,7MB de texto
const MAX_ATTACHMENT_BASE64 = 14 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const AttachmentSchema = z.object({
  data: z.string().min(1).max(MAX_ATTACHMENT_BASE64, 'Anexo excede o limite de 10MB'),
  mimeType: z
    .string()
    .refine((m) => ALLOWED_ATTACHMENT_MIMES.includes(m), 'Tipo de anexo não suportado'),
  name: z.string().max(255),
});

export const TransactionSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid(),
  type: z.enum(['DEBT', 'PAYMENT', 'REFUND', 'ABATIMENTO']),
  amount: z.number().positive(),
  description: z.string().max(2000).default(''),
  occurred_at: z.union([z.number(), z.string()]).optional(),
  due_date: z.union([z.number(), z.string()]).optional().nullable(),
  payment_method: z
    .enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'COMPENSATION'])
    .optional()
    .nullable(),
  attachment: AttachmentSchema.optional().nullable(),
  installment_number: z.number().int().positive().optional().nullable(),
  total_installments: z.number().int().positive().optional().nullable(),
  installment_group_id: z.string().uuid().optional().nullable(),
  interest_rate: z.number().min(0).max(100).optional().nullable(),
  // Referência opcional a um lançamento específico (ex.: pagamento contra
  // uma dívida pontual). Ausente = pagamento avulso contra o saldo total.
  applies_to_transaction_id: z.string().uuid().optional().nullable(),
});

const toDate = (v: number | string | null | undefined): Date | null => {
  if (v === null || v === undefined) return null;
  const d = typeof v === 'number' ? new Date(v) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Data inválida', 'INVALID_DATE');
  return d;
};

const TX_COLUMNS = `id, customer_id, owner_user_id, created_by_user_id, type, status, amount, description,
  occurred_at, due_date, payment_method, attachment, installment_number,
  total_installments, installment_group_id, interest_rate, applies_to_transaction_id,
  created_at, updated_at`;

async function logEvent(transactionId: string, actorUserId: string, action: string, note?: string) {
  await query(
    `INSERT INTO transaction_events (transaction_id, actor_user_id, action, note) VALUES ($1, $2, $3, $4)`,
    [transactionId, actorUserId, action, note ?? null],
  );
}

// GET /api/transactions?customer_id= — lançamentos do dono
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const params: unknown[] = [req.user!.sub];
    let where = 'owner_user_id = $1';
    if (req.query.customer_id) {
      params.push(String(req.query.customer_id));
      where += ` AND customer_id = $${params.length}`;
    }
    const result = await query(
      `SELECT ${TX_COLUMNS} FROM transactions WHERE ${where} ORDER BY occurred_at DESC LIMIT 2000`,
      params,
    );
    res.json({ success: true, transactions: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions — dono lança contra seu cliente; cliente VINCULADO
// (a contraparte) também pode lançar um pagamento contra si mesmo (nunca
// DEBT). Contra cliente vinculado, sempre nasce PENDING — exige aprovação
// de quem NÃO criou (dono aprova pagamento do devedor, devedor aprova
// dívida/lançamento do dono).
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = TransactionSchema.parse(req.body);
    const customer = await query(
      `SELECT id, owner_user_id, linked_user_id FROM customers
        WHERE id = $1 AND deleted_at IS NULL`,
      [body.customer_id],
    );
    if (!customer.rows[0])
      return next(new ApiError(404, 'Cliente não encontrado', 'CUSTOMER_NOT_FOUND'));
    const c = customer.rows[0];

    const isOwner = c.owner_user_id === req.user!.sub;
    const isLinkedCounterpart = c.linked_user_id === req.user!.sub;
    if (!isOwner && !isLinkedCounterpart) {
      return next(new ApiError(404, 'Cliente não encontrado', 'CUSTOMER_NOT_FOUND'));
    }
    if (isLinkedCounterpart && body.type === 'DEBT') {
      return next(
        new ApiError(
          400,
          'Você não pode lançar uma dívida contra o comerciante — apenas pagamentos',
          'INVALID_TYPE_FOR_COUNTERPART',
        ),
      );
    }
    if (body.applies_to_transaction_id) {
      const ref = await query(`SELECT id FROM transactions WHERE id = $1 AND customer_id = $2`, [
        body.applies_to_transaction_id,
        body.customer_id,
      ]);
      if (!ref.rows[0])
        return next(new ApiError(400, 'Lançamento de referência inválido', 'INVALID_REFERENCE'));
    }

    // Sempre PENDING quando há vínculo — a outra parte precisa aprovar.
    const status = c.linked_user_id ? 'PENDING' : 'CONFIRMED';
    const result = await query(
      `INSERT INTO transactions (id, customer_id, owner_user_id, created_by_user_id, type, status, amount, description,
                                 occurred_at, due_date, payment_method, attachment,
                                 installment_number, total_installments, installment_group_id, interest_rate,
                                 applies_to_transaction_id)
       VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8,
               COALESCE($9, NOW()), $10, $11, $12::jsonb, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO NOTHING
       RETURNING ${TX_COLUMNS}`,
      [
        body.id ?? null,
        body.customer_id,
        c.owner_user_id,
        req.user!.sub,
        body.type,
        status,
        body.amount,
        body.description,
        toDate(body.occurred_at),
        toDate(body.due_date),
        body.payment_method ?? null,
        body.attachment ? JSON.stringify(body.attachment) : null,
        body.installment_number ?? null,
        body.total_installments ?? null,
        body.installment_group_id ?? null,
        body.interest_rate ?? null,
        body.applies_to_transaction_id ?? null,
      ],
    );
    if (!result.rows[0]) return next(new ApiError(409, 'Lançamento já existe', 'ALREADY_EXISTS'));
    await logEvent(result.rows[0].id, req.user!.sub, 'CREATED');
    res.status(201).json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// PATCH /api/transactions/:id — edição pelo dono; cliente vinculado → volta a PENDING
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = TransactionSchema.partial().omit({ id: true, customer_id: true }).parse(req.body);
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0)
      return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));

    const own = await query(
      `SELECT t.id, c.linked_user_id FROM transactions t
        JOIN customers c ON c.id = t.customer_id
       WHERE t.id = $1 AND t.owner_user_id = $2`,
      [req.params.id, req.user!.sub],
    );
    if (!own.rows[0]) return next(new ApiError(404, 'Lançamento não encontrado', 'NOT_FOUND'));

    const setParts: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of fields) {
      if (k === 'occurred_at' || k === 'due_date') {
        values.push(toDate(v as number | string | null));
      } else if (k === 'attachment') {
        values.push(v ? JSON.stringify(v) : null);
      } else {
        values.push(v);
      }
      setParts.push(
        k === 'attachment' ? `${k} = $${values.length + 2}::jsonb` : `${k} = $${values.length + 2}`,
      );
    }
    // Cliente vinculado: alteração exige nova aprovação
    if (own.rows[0].linked_user_id) setParts.push(`status = 'PENDING'`);

    const result = await query(
      `UPDATE transactions SET ${setParts.join(', ')}
        WHERE id = $1 AND owner_user_id = $2
        RETURNING ${TX_COLUMNS}`,
      [req.params.id, req.user!.sub, ...values],
    );
    if (own.rows[0].linked_user_id)
      await logEvent(req.params.id, req.user!.sub, 'RESENT', 'Editado pelo dono');
    res.json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

const DecisionSchema = z.object({ note: z.string().max(500).optional() });

// POST /api/transactions/:id/approve — só o usuário vinculado
router.post('/:id/approve', decision('APPROVED', 'CONFIRMED'));
// POST /api/transactions/:id/reject — só o usuário vinculado
router.post('/:id/reject', decision('REJECTED', 'REJECTED'));

// Quem aprova/recusa é sempre "a outra parte" em relação a quem criou:
// dono criou (DEBT/pagamento contra o cliente) → aprova o vinculado;
// vinculado criou (pagamento contra si mesmo) → aprova o dono.
function decision(action: 'APPROVED' | 'REJECTED', newStatus: 'CONFIRMED' | 'REJECTED') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = DecisionSchema.parse(req.body ?? {});
      const result = await query(
        `UPDATE transactions t SET status = $3
           FROM customers c
          WHERE t.id = $1 AND c.id = t.customer_id AND t.status = 'PENDING'
            AND (
                  (t.created_by_user_id = t.owner_user_id AND c.linked_user_id = $2)
               OR (t.created_by_user_id = c.linked_user_id AND t.owner_user_id = $2)
            )
          RETURNING t.id`,
        [req.params.id, req.user!.sub, newStatus],
      );
      if (!result.rows[0]) {
        return next(new ApiError(404, 'Lançamento pendente não encontrado para você', 'NOT_FOUND'));
      }
      await logEvent(req.params.id, req.user!.sub, action, body.note);
      res.json({ success: true, status: newStatus });
    } catch (err) {
      if (err instanceof z.ZodError)
        return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
      next(err);
    }
  };
}

// POST /api/transactions/:id/resend — só quem criou de fato; REJECTED volta para PENDING
router.post('/:id/resend', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `UPDATE transactions SET status = 'PENDING'
        WHERE id = $1 AND created_by_user_id = $2 AND status = 'REJECTED'
        RETURNING id`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rows[0]) {
      return next(new ApiError(404, 'Lançamento recusado não encontrado', 'NOT_FOUND'));
    }
    await logEvent(req.params.id, req.user!.sub, 'RESENT');
    res.json({ success: true, status: 'PENDING' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id — dono remove lançamento (eventos caem em cascata)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `DELETE FROM transactions WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Lançamento não encontrado', 'NOT_FOUND'));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/:id/events — trilha de auditoria (dono ou vinculado)
router.get('/:id/events', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT e.id, e.action, e.note, e.created_at, u.full_name AS actor_name
         FROM transaction_events e
         JOIN transactions t ON t.id = e.transaction_id
         JOIN customers c ON c.id = t.customer_id
         JOIN users u ON u.id = e.actor_user_id
        WHERE e.transaction_id = $1 AND (t.owner_user_id = $2 OR c.linked_user_id = $2)
        ORDER BY e.created_at ASC`,
      [req.params.id, req.user!.sub],
    );
    res.json({ success: true, events: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
