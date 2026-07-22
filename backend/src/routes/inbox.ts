import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/inbox — lançamentos PENDING contra MIM (sou o usuário vinculado
 * do cliente). É o que o Dyllan vê quando o Jorge lança uma despesa.
 */
router.get('/inbox', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT t.id, t.type, t.amount, t.description, t.occurred_at, t.due_date, t.status,
              t.created_at,
              c.name  AS customer_name,
              o.id    AS owner_id,
              o.full_name AS owner_name,
              o.phone AS owner_phone
         FROM transactions t
         JOIN customers c ON c.id = t.customer_id
         JOIN users o ON o.id = t.owner_user_id
        WHERE c.linked_user_id = $1 AND t.status = 'PENDING'
        ORDER BY t.created_at DESC`,
      [req.user!.sub]
    );
    res.json({ success: true, items: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/counterpart — minha visão como CLIENTE: saldo a pagar/receber
 * por comerciante, calculado só com lançamentos CONFIRMED.
 */
router.get('/counterpart', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT o.id AS owner_id,
              o.full_name AS owner_name,
              o.phone AS owner_phone,
              o.pix_key AS owner_pix_key,
              c.id AS customer_id,
              COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'CONFIRMED' AND t.type = 'DEBT'), 0)
            - COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'CONFIRMED' AND t.type IN ('PAYMENT','ABATIMENTO')), 0)
            + COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'CONFIRMED' AND t.type = 'REFUND'), 0) AS balance,
              COUNT(*) FILTER (WHERE t.status = 'PENDING')  AS pending_count,
              COUNT(*) FILTER (WHERE t.status = 'CONFIRMED') AS confirmed_count,
              MAX(t.occurred_at) AS last_activity
         FROM customers c
         JOIN users o ON o.id = c.owner_user_id
         LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.linked_user_id = $1 AND c.deleted_at IS NULL
        GROUP BY o.id, o.full_name, o.phone, o.pix_key, c.id
        ORDER BY o.full_name ASC`,
      [req.user!.sub]
    );
    res.json({ success: true, counterparts: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/counterpart/:customerId/transactions — histórico completo (todos
 * os status) do MEU relacionamento como cliente com um comerciante
 * específico. Só o usuário vinculado a esse customer pode ver.
 */
router.get('/counterpart/:customerId/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const owns = await query(
      `SELECT id FROM customers WHERE id = $1 AND linked_user_id = $2 AND deleted_at IS NULL`,
      [req.params.customerId, req.user!.sub]
    );
    if (!owns.rows[0]) return next(new ApiError(404, 'Relacionamento não encontrado', 'NOT_FOUND'));

    const result = await query(
      `SELECT id, type, status, amount, description, occurred_at, due_date,
              payment_method, attachment, created_by_user_id, applies_to_transaction_id,
              created_at, updated_at
         FROM transactions
        WHERE customer_id = $1
        ORDER BY occurred_at DESC
        LIMIT 2000`,
      [req.params.customerId]
    );
    res.json({ success: true, transactions: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

export default router;
