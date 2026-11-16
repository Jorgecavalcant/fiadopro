import { query } from '../config/database.js';
import { normalizePhone } from '../utils/phone.js';

export { normalizePhone };

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

  let emailUser: string | null = null;
  if (email !== '') {
    const emailResult = await query(
      'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
      [email, customer.owner_user_id],
    );
    emailUser = emailResult.rows[0]?.id ?? null;
  }

  let phoneUser: { id: string; phone_verified_at?: Date | string | null } | null = null;
  if (normalizedPhone !== '') {
    const phoneResult = await query(
      'SELECT id, phone_verified_at FROM users WHERE fn_norm_phone(phone) = $1 AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
      [normalizedPhone, customer.owner_user_id],
    );
    phoneUser = phoneResult.rows[0] ?? null;
  }

  if (emailUser && phoneUser && emailUser !== phoneUser.id) {
    await query(
      'INSERT INTO link_review_queue (customer_id, owner_user_id, email_user_id, phone_user_id, customer_email, customer_phone, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        customer.id,
        customer.owner_user_id,
        emailUser,
        phoneUser.id,
        customer.email,
        customer.phone,
        'email_phone_user_conflict',
      ],
    );
    await query('UPDATE customers SET linked_user_id = NULL WHERE id = $1', [customer.id]);
    console.warn('[linking] conflict customer', customer.id);
    return null;
  }

  let targetUserId: string | null = null;
  if (emailUser && phoneUser && emailUser === phoneUser.id) {
    targetUserId = emailUser;
  } else if (emailUser) {
    targetUserId = emailUser;
  } else if (phoneUser?.phone_verified_at !== null && phoneUser?.phone_verified_at !== undefined) {
    targetUserId = phoneUser.id;
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

  const candidatesResult = await query(
    'SELECT id FROM customers WHERE linked_user_id IS NULL AND deleted_at IS NULL AND owner_user_id <> $1 AND (($2::text IS NOT NULL AND lower(email) = lower($2)) OR ($3::text IS NOT NULL AND fn_norm_phone(phone) = $3))',
    [userId, email, phone],
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
