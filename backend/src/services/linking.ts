import { query } from '../config/database.js';
import { normalizePhone, phoneMatchVariants, phonesMatchMobile9th } from '../utils/phone.js';

export { normalizePhone, phonesMatchMobile9th, phoneMatchVariants };

export const LINKED_MESSAGE = 'Conta encontrada e vinculada';
export const UNLINKED_MESSAGE =
  'Cliente ainda não tem conta no Fiado Pro — o vínculo acontece automático quando ele se cadastrar';

export function linkFeedback(linkedUserId: string | null): { linked: boolean; message: string } {
  return {
    linked: Boolean(linkedUserId),
    message: linkedUserId ? LINKED_MESSAGE : UNLINKED_MESSAGE,
  };
}

async function findActiveUserByEmail(
  email: string,
  excludeUserId: string,
): Promise<string | null> {
  const emailResult = await query(
    'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
    [email, excludeUserId],
  );
  return (emailResult.rows[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Matcher primário: telefone (com equivalência do 9º dígito).
 * Secundário: e-mail. Conflito telefone≠e-mail → link_review_queue.
 * Não exige phone_verified_at (reversão da regra do PR #70).
 */
export async function linkCustomer(customerId: string): Promise<string | null> {
  const customerResult = await query(
    'SELECT id, owner_user_id, email, phone, linked_user_id FROM customers WHERE id = $1 AND deleted_at IS NULL',
    [customerId],
  );
  const customer = customerResult.rows[0];

  if (!customer) {
    return null;
  }

  const email = typeof customer.email === 'string' ? customer.email.trim() : '';
  const phone = typeof customer.phone === 'string' ? customer.phone : '';
  const normalizedPhone = normalizePhone(phone);
  const variants = phoneMatchVariants(normalizedPhone);

  let emailUser: string | null = null;
  if (email !== '') {
    emailUser = await findActiveUserByEmail(email, customer.owner_user_id);
  }

  let phoneUser: string | null = null;
  if (variants.length > 0) {
    const phoneResult = await query(
      `SELECT id, phone FROM users
        WHERE fn_norm_phone(phone) = ANY($1::text[])
          AND id <> $2
          AND deleted_at IS NULL
          AND is_active = TRUE`,
      [variants, customer.owner_user_id],
    );
    const matchedIds = new Set<string>();
    for (const row of phoneResult.rows as { id: string; phone: string | null }[]) {
      const userNorm = normalizePhone(row.phone);
      if (phonesMatchMobile9th(normalizedPhone, userNorm) || variants.includes(userNorm)) {
        matchedIds.add(row.id);
      }
    }
    if (matchedIds.size === 1) {
      phoneUser = [...matchedIds][0] ?? null;
    }
  }

  if (emailUser && phoneUser && emailUser !== phoneUser) {
    try {
      await query(
        'INSERT INTO link_review_queue (customer_id, owner_user_id, email_user_id, phone_user_id, customer_email, customer_phone, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          customer.id,
          customer.owner_user_id,
          emailUser,
          phoneUser,
          customer.email,
          customer.phone,
          'email_phone_user_conflict',
        ],
      );
    } catch {
      console.warn('[linking] conflict queue unavailable', customer.id);
    }
    await query('UPDATE customers SET linked_user_id = NULL WHERE id = $1', [customer.id]);
    console.warn('[linking] conflict customer', customer.id);
    return null;
  }

  // Telefone primeiro; e-mail só se não houver match de telefone.
  let targetUserId: string | null = null;
  if (phoneUser) {
    targetUserId = phoneUser;
  } else if (emailUser) {
    targetUserId = emailUser;
  }

  if (!targetUserId) {
    if (customer.linked_user_id) {
      await query('UPDATE customers SET linked_user_id = NULL WHERE id = $1', [customer.id]);
    }
    return null;
  }

  await query('UPDATE customers SET linked_user_id = $2 WHERE id = $1', [customer.id, targetUserId]);
  return targetUserId;
}

/** Relink barato: só candidatos sem vínculo que batem telefone/e-mail do usuário. */
export async function relinkCustomersForUser(userId: string): Promise<number> {
  let linkedCount = 0;

  const linkedCustomersResult = await query(
    'SELECT id FROM customers WHERE linked_user_id = $1 AND deleted_at IS NULL',
    [userId],
  );

  for (const customer of linkedCustomersResult.rows) {
    if (await linkCustomer(customer.id)) {
      linkedCount += 1;
    }
  }

  const userResult = await query(
    'SELECT email, phone FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId],
  );
  const user = userResult.rows[0];

  if (!user) {
    return linkedCount;
  }

  const email = typeof user.email === 'string' && user.email.trim() !== '' ? user.email : null;
  const phone =
    typeof user.phone === 'string' && normalizePhone(user.phone) !== ''
      ? normalizePhone(user.phone)
      : null;
  const variants = phone ? phoneMatchVariants(phone) : [];

  if (!email && variants.length === 0) {
    return linkedCount;
  }

  const candidatesResult = await query(
    `SELECT id FROM customers
      WHERE linked_user_id IS NULL
        AND deleted_at IS NULL
        AND owner_user_id <> $1
        AND (
          ($2::text IS NOT NULL AND lower(email) = lower($2))
          OR (cardinality($3::text[]) > 0 AND fn_norm_phone(phone) = ANY($3::text[]))
        )`,
    [userId, email, variants],
  );

  for (const customer of candidatesResult.rows) {
    if (await linkCustomer(customer.id)) {
      linkedCount += 1;
    }
  }

  return linkedCount;
}

export async function ensureAdminRole(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    return;
  }

  try {
    await query(
      'UPDATE users SET role = $1 WHERE role = $2 AND lower(email) <> lower($3)',
      ['user', 'admin', adminEmail],
    );
    await query(
      'UPDATE users SET role = $1 WHERE lower(email) = lower($2) AND deleted_at IS NULL',
      ['admin', adminEmail],
    );
  } catch (error) {
    console.warn('Unable to ensure admin role', error);
  }
}
