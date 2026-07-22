import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { linkCustomer } from '../services/linking.js';

const router = Router();
router.use(requireAuth);

const NoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().max(2000),
  createdAt: z.number(),
});

export const CustomerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(255).optional().nullable(),
  pix_key: z.string().max(140).optional().nullable(),
  trusted: z.boolean().optional(),
  overpayment_strategy: z.enum(['PROFIT', 'RETURN']).optional(),
  notes: z.array(NoteSchema).max(200).optional(),
  score: z.number().int().min(0).max(1000).optional().nullable(),
});

const CUSTOMER_COLUMNS = `id, owner_user_id, linked_user_id, name, phone, email, pix_key,
  trusted, overpayment_strategy, notes, score, created_at, updated_at`;

// GET /api/customers — todos os clientes do dono (com contagem de pendências)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT ${CUSTOMER_COLUMNS},
              (SELECT COUNT(*) FROM transactions t
                WHERE t.customer_id = customers.id AND t.status = 'PENDING') AS pending_count
         FROM customers
        WHERE owner_user_id = $1 AND deleted_at IS NULL
        ORDER BY name ASC`,
      [req.user!.sub]
    );
    res.json({ success: true, customers: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers — cria (aceita id do cliente para sync offline-first)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CustomerSchema.parse(req.body);
    const result = await query(
      `INSERT INTO customers (id, owner_user_id, name, phone, email, pix_key, trusted, overpayment_strategy, notes, score)
       VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, 'RETURN'), COALESCE($9::jsonb, '[]'::jsonb), $10)
       ON CONFLICT (id) DO NOTHING
       RETURNING ${CUSTOMER_COLUMNS}`,
      [body.id ?? null, req.user!.sub, body.name, body.phone, body.email ?? null, body.pix_key ?? null,
       body.trusted ?? null, body.overpayment_strategy ?? null,
       body.notes ? JSON.stringify(body.notes) : null, body.score ?? null]
    );
    if (!result.rows[0]) return next(new ApiError(409, 'Cliente já existe', 'ALREADY_EXISTS'));
    const customer = result.rows[0];
    customer.linked_user_id = await linkCustomer(customer.id);
    res.status(201).json({ success: true, customer });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user!.sub]
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = CustomerSchema.partial().omit({ id: true }).parse(req.body);
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));

    const setClause = fields
      .map(([k], i) => (k === 'notes' ? `${k} = $${i + 3}::jsonb` : `${k} = $${i + 3}`))
      .join(', ');
    const values = fields.map(([k, v]) => (k === 'notes' ? JSON.stringify(v) : v));

    const result = await query(
      `UPDATE customers SET ${setClause}
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        RETURNING ${CUSTOMER_COLUMNS}`,
      [req.params.id, req.user!.sub, ...values]
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    const customer = result.rows[0];
    if (body.phone !== undefined || body.email !== undefined) {
      customer.linked_user_id = await linkCustomer(customer.id);
    }
    res.json({ success: true, customer });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// DELETE /api/customers/:id — soft delete
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `UPDATE customers SET deleted_at = NOW()
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [req.params.id, req.user!.sub]
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
