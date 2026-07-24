import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Todas as rotas exigem autenticação
router.use(requireAuth);

const DebtSchema = z.object({
  creditor_name: z.string().min(1).max(255),
  original_amount: z.number().positive(),
  current_amount: z.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interest_rate: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// GET /api/debts  — lista dívidas do usuário logado
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, order = 'due_date' } = req.query;
    const allowedOrder = ['due_date', 'current_amount', 'creditor_name', 'created_at'];
    const orderBy = allowedOrder.includes(String(order)) ? order : 'due_date';

    let sql = `
      SELECT
        d.*,
        CURRENT_DATE - d.due_date AS days_overdue,
        COALESCE(SUM(p.amount), 0) AS total_paid
      FROM debts d
      LEFT JOIN payments p ON p.debt_id = d.id
      WHERE d.user_id = $1
    `;
    const params: unknown[] = [req.user!.sub];

    if (status) {
      params.push(status);
      sql += ` AND d.status = $${params.length}`;
    }

    sql += ` GROUP BY d.id ORDER BY ${orderBy} ASC`;

    const result = await query(sql, params);
    res.json({ success: true, debts: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/debts/summary  — resumo financeiro
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COALESCE(SUM(current_amount) FILTER (WHERE status = 'active'), 0) AS active_total,
        COALESCE(SUM(current_amount) FILTER (WHERE status = 'active' AND due_date < CURRENT_DATE), 0) AS overdue_total,
        COUNT(*) FILTER (WHERE status = 'active' AND due_date < CURRENT_DATE) AS overdue_count,
        COALESCE(SUM(current_amount) FILTER (WHERE status = 'paid'), 0) AS paid_total,
        MIN(due_date) FILTER (WHERE status = 'active' AND due_date >= CURRENT_DATE) AS next_due_date
      FROM debts
      WHERE user_id = $1`,
      [req.user!.sub],
    );
    res.json({ success: true, summary: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/debts/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT d.*, COALESCE(SUM(p.amount), 0) AS total_paid
       FROM debts d LEFT JOIN payments p ON p.debt_id = d.id
       WHERE d.id = $1 AND d.user_id = $2
       GROUP BY d.id`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Dívida não encontrada', 'NOT_FOUND'));
    res.json({ success: true, debt: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/debts
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = DebtSchema.parse(req.body);
    const result = await query(
      `INSERT INTO debts (user_id, creditor_name, original_amount, current_amount, due_date, interest_rate, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user!.sub,
        body.creditor_name,
        body.original_amount,
        body.current_amount,
        body.due_date,
        body.interest_rate ?? null,
        body.notes ?? null,
      ],
    );
    res.status(201).json({ success: true, debt: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// PATCH /api/debts/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Checar que pertence ao usuário
    const own = await query('SELECT id FROM debts WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user!.sub,
    ]);
    if (!own.rows[0]) return next(new ApiError(404, 'Dívida não encontrada', 'NOT_FOUND'));

    const body = DebtSchema.partial().parse(req.body);
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0)
      return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));

    const setClause = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    const result = await query(
      `UPDATE debts SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values],
    );
    res.json({ success: true, debt: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// DELETE /api/debts/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.user!.sub,
    ]);
    if (!result.rows[0]) return next(new ApiError(404, 'Dívida não encontrada', 'NOT_FOUND'));
    res.json({ success: true, message: 'Dívida removida' });
  } catch (err) {
    next(err);
  }
});

// POST /api/debts/:id/payments  — registrar pagamento
router.post('/:id/payments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const own = await query('SELECT id, current_amount FROM debts WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user!.sub,
    ]);
    if (!own.rows[0]) return next(new ApiError(404, 'Dívida não encontrada', 'NOT_FOUND'));

    const { amount, payment_date, payment_method, notes } = z
      .object({
        amount: z.number().positive(),
        payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        payment_method: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    // Registra pagamento
    const payment = await query(
      'INSERT INTO payments (debt_id, amount, payment_date, payment_method, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, amount, payment_date, payment_method ?? null, notes ?? null],
    );

    // Atualiza saldo da dívida
    const newAmount = Math.max(0, Number(own.rows[0].current_amount) - amount);
    const newStatus = newAmount === 0 ? 'paid' : 'active';
    await query(
      'UPDATE debts SET current_amount = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [newAmount, newStatus, req.params.id],
    );

    res.status(201).json({ success: true, payment: payment.rows[0], remaining: newAmount });
  } catch (err) {
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    next(err);
  }
});

// GET /api/debts/:id/payments
router.get('/:id/payments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const own = await query('SELECT id FROM debts WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user!.sub,
    ]);
    if (!own.rows[0]) return next(new ApiError(404, 'Dívida não encontrada', 'NOT_FOUND'));

    const result = await query(
      'SELECT * FROM payments WHERE debt_id = $1 ORDER BY payment_date DESC',
      [req.params.id],
    );
    res.json({ success: true, payments: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
