import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { linkCustomer, linkFeedback } from '../services/linking.js';
import { normalizeEmail } from '../utils/normalizeEmail.js';
import { normalizePhone, PHONE_INVALID_MESSAGE, validatePhoneInput } from '../utils/phone.js';
import { OWN_EMAIL_MESSAGE, OWN_PHONE_MESSAGE } from '../services/accountAccess.js';
import { assertCanAddCustomers } from '../services/planLimits.js';

function requireValidCustomerPhone(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') return '';
  try {
    return validatePhoneInput(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : PHONE_INVALID_MESSAGE;
    throw new ApiError(400, message, 'INVALID_PHONE');
  }
}

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
  phone: z.union([z.string().max(30), z.literal('')]).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  pix_key: z.string().max(140).optional().nullable(),
  trusted: z.boolean().optional(),
  overpayment_strategy: z.enum(['PROFIT', 'RETURN']).optional(),
  notes: z.array(NoteSchema).max(200).optional(),
  score: z.number().int().min(0).max(1000).optional().nullable(),
});

const CUSTOMER_COLUMNS = `id, owner_user_id, linked_user_id, name, phone, email, pix_key,
  trusted, overpayment_strategy, notes, score, created_at, updated_at`;

const COUNTERPART_CLOSED = `EXISTS (
  SELECT 1 FROM users u
   WHERE u.id = customers.linked_user_id
     AND u.deleted_at IS NOT NULL
     AND u.purge_completed_at IS NULL
) AS counterpart_closed`;

export async function activeCustomerWithSamePhone(
  ownerId: string,
  phone: string | null | undefined,
  excludeId?: string | null,
): Promise<{ id: string; name: string } | null> {
  const normalized = normalizePhone(phone);
  if (normalized === '') return null;
  const result = await query(
    `SELECT id, name, phone
       FROM customers
      WHERE owner_user_id = $1
        AND deleted_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [ownerId, excludeId ?? null],
  );
  for (const row of result.rows) {
    if (normalizePhone(String(row.phone ?? '')) === normalized) {
      return { id: String(row.id), name: String(row.name ?? '') };
    }
  }
  return null;
}

export async function activeCustomerWithSameEmail(
  ownerId: string,
  email: string | null | undefined,
  excludeId?: string | null,
): Promise<{ id: string; name: string } | null> {
  const normalized = normalizeEmail(email ?? '');
  if (normalized === '') return null;
  const result = await query(
    `SELECT id, name, email
       FROM customers
      WHERE owner_user_id = $1
        AND deleted_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [ownerId, excludeId ?? null],
  );
  for (const row of result.rows) {
    if (normalizeEmail(String(row.email ?? '')) === normalized) {
      return { id: String(row.id), name: String(row.name ?? '') };
    }
  }
  return null;
}

export function duplicatePhoneError(found: { id: string; name: string }): ApiError {
  return new ApiError(409, `Já existe ${found.name} com esse número`, 'DUPLICATE_PHONE', {
    existingCustomerId: found.id,
  });
}

export function duplicateEmailError(found: { id: string; name: string }): ApiError {
  return new ApiError(409, `Já existe ${found.name} com esse e-mail`, 'DUPLICATE_EMAIL', {
    existingCustomerId: found.id,
  });
}

async function ownContactError(
  userId: string,
  phone?: string | null,
  email?: string | null,
): Promise<string | null> {
  const touchesPhone = phone !== undefined && phone !== null && phone !== '';
  const touchesEmail = email !== undefined && email !== null && email !== '';
  if (!touchesPhone && !touchesEmail) return null;
  const me = await query('SELECT email, phone FROM users WHERE id = $1', [userId]);
  const row = me.rows[0];
  if (!row) return null;
  if (
    touchesPhone &&
    normalizePhone(phone) !== '' &&
    normalizePhone(phone) === normalizePhone(row.phone)
  ) {
    return OWN_PHONE_MESSAGE;
  }
  if (touchesEmail && normalizeEmail(email as string) === normalizeEmail(String(row.email ?? ''))) {
    return OWN_EMAIL_MESSAGE;
  }
  return null;
}

function isUniqueViolation(err: unknown): err is { code: string; constraint?: string; detail?: string } {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
}

async function uniqueViolationError(
  err: unknown,
  ownerId: string,
  phone?: string | null,
  email?: string | null,
  excludeId?: string | null,
): Promise<ApiError | null> {
  if (!isUniqueViolation(err)) return null;

  const constraint = String(err.constraint ?? '').toLowerCase();
  const detail = String(err.detail ?? '').toLowerCase();
  const emailConstraint = constraint.includes('email') || detail.includes('email');
  const phoneConstraint = constraint.includes('phone') || detail.includes('phone');

  if (emailConstraint) {
    const found = await activeCustomerWithSameEmail(ownerId, email, excludeId);
    if (found) return duplicateEmailError(found);
  }
  if (phoneConstraint) {
    const found = await activeCustomerWithSamePhone(ownerId, phone, excludeId);
    if (found) return duplicatePhoneError(found);
  }

  if (!emailConstraint && email) {
    const found = await activeCustomerWithSameEmail(ownerId, email, excludeId);
    if (found) return duplicateEmailError(found);
  }
  if (!phoneConstraint && phone) {
    const found = await activeCustomerWithSamePhone(ownerId, phone, excludeId);
    if (found) return duplicatePhoneError(found);
  }
  return null;
}

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT ${CUSTOMER_COLUMNS},
              (SELECT COUNT(*) FROM transactions t
                WHERE t.customer_id = customers.id AND t.status = 'PENDING') AS pending_count,
              ${COUNTERPART_CLOSED}
         FROM customers
        WHERE owner_user_id = $1 AND deleted_at IS NULL
        ORDER BY name ASC`,
      [req.user!.sub],
    );
    res.json({ success: true, customers: result.rows, total: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  let body: z.infer<typeof CustomerSchema> | undefined;
  try {
    body = CustomerSchema.parse(req.body);
    body.phone = requireValidCustomerPhone(body.phone ?? '');
    const own = await ownContactError(req.user!.sub, body.phone, body.email);
    if (own) return next(new ApiError(400, own, 'OWN_CONTACT'));
    const duplicatePhone = await activeCustomerWithSamePhone(
      req.user!.sub,
      body.phone,
      body.id ?? null,
    );
    if (duplicatePhone) return next(duplicatePhoneError(duplicatePhone));
    const duplicateEmail = await activeCustomerWithSameEmail(
      req.user!.sub,
      body.email,
      body.id ?? null,
    );
    if (duplicateEmail) return next(duplicateEmailError(duplicateEmail));

    const userId = req.user!.sub;
    let adding = 1;
    if (body.id) {
      const existing = await query(
        `SELECT 1 FROM customers WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
        [body.id, userId],
      );
      if (existing.rows.length > 0) adding = 0;
    }
    if (adding === 1) await assertCanAddCustomers(userId, 1);
    const result = await query(
      `INSERT INTO customers (id, owner_user_id, name, phone, email, pix_key, trusted, overpayment_strategy, notes, score)
       VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, COALESCE($7, FALSE), COALESCE($8, 'RETURN'), COALESCE($9::jsonb, '[]'::jsonb), $10)
       ON CONFLICT (id) DO NOTHING
       RETURNING ${CUSTOMER_COLUMNS}`,
      [
        body.id ?? null,
        req.user!.sub,
        body.name,
        body.phone,
        body.email ? normalizeEmail(body.email) : body.email ?? null,
        body.pix_key ?? null,
        body.trusted ?? null,
        body.overpayment_strategy ?? null,
        body.notes ? JSON.stringify(body.notes) : null,
        body.score ?? null,
      ],
    );
    if (!result.rows[0]) return next(new ApiError(409, 'Cliente já existe', 'ALREADY_EXISTS'));
    const customer = result.rows[0];
    customer.linked_user_id = await linkCustomer(customer.id);
    res.status(201).json({
      success: true,
      customer,
      link: linkFeedback(customer.linked_user_id),
    });
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    const uniqueError = await uniqueViolationError(
      err,
      req.user!.sub,
      body?.phone,
      body?.email,
      body?.id ?? null,
    );
    if (uniqueError) return next(uniqueError);
    next(err);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT ${CUSTOMER_COLUMNS}, ${COUNTERPART_CLOSED} FROM customers
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  let phoneForDup: string | null | undefined;
  let emailForDup: string | null | undefined;
  try {
    const body = CustomerSchema.partial().omit({ id: true }).parse(req.body);
    if (body.phone !== undefined) {
      body.phone = requireValidCustomerPhone(body.phone);
    }
    phoneForDup = body.phone;
    emailForDup = body.email;
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length === 0)
      return next(new ApiError(400, 'Nenhum campo para atualizar', 'EMPTY_UPDATE'));
    const own = await ownContactError(
      req.user!.sub,
      body.phone === undefined ? undefined : body.phone,
      body.email === undefined ? undefined : body.email,
    );
    if (own) return next(new ApiError(400, own, 'OWN_CONTACT'));
    if (body.phone !== undefined) {
      const duplicate = await activeCustomerWithSamePhone(req.user!.sub, body.phone, req.params.id);
      if (duplicate) return next(duplicatePhoneError(duplicate));
    }
    if (body.email !== undefined) {
      const duplicate = await activeCustomerWithSameEmail(req.user!.sub, body.email, req.params.id);
      if (duplicate) return next(duplicateEmailError(duplicate));
    }

    const setClause = fields
      .map(([k], i) => (k === 'notes' ? `${k} = $${i + 3}::jsonb` : `${k} = $${i + 3}`))
      .join(', ');
    const values = fields.map(([k, v]) => {
      if (k === 'notes') return JSON.stringify(v);
      if (k === 'email' && typeof v === 'string') return normalizeEmail(v);
      return v;
    });

    const result = await query(
      `UPDATE customers SET ${setClause}
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        RETURNING ${CUSTOMER_COLUMNS}`,
      [req.params.id, req.user!.sub, ...values],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    const customer = result.rows[0];
    let link = linkFeedback(customer.linked_user_id ?? null);
    if (body.phone !== undefined || body.email !== undefined) {
      customer.linked_user_id = await linkCustomer(customer.id);
      link = linkFeedback(customer.linked_user_id);
    }
    res.json({ success: true, customer, link });
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (err instanceof z.ZodError)
      return next(new ApiError(400, err.errors[0].message, 'VALIDATION_ERROR'));
    const uniqueError = await uniqueViolationError(
      err,
      req.user!.sub,
      phoneForDup,
      emailForDup,
      req.params.id,
    );
    if (uniqueError) return next(uniqueError);
    next(err);
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `UPDATE customers SET deleted_at = NOW()
        WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [req.params.id, req.user!.sub],
    );
    if (!result.rows[0]) return next(new ApiError(404, 'Cliente não encontrado', 'NOT_FOUND'));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
