import { query } from '../config/database.js';
import { normalizePhone } from '../utils/phone.js';

export { normalizePhone };

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
  const normalizedPhone = normalizePhone(customer.phone);
  const ownerUserId = customer.owner_user_id;

  let phoneUser: string | null = null;
  if (normalizedPhone !== '') {
    const phoneResult = await query(
      'SELECT id FROM users WHERE fn_norm_phone(phone) = $1 AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
      [normalizedPhone, ownerUserId],
    );
    phoneUser = phoneResult.rows[0]?.id ?? null;
  }

  let emailUser: string | null = null;
  if (email !== '') {
    const emailResult = await query(
      'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
      [email, ownerUserId],
    );
    emailUser = emailResult.rows[0]?.id ?? null;
  }

  if (emailUser && phoneUser && emailUser !== phoneUser) {
    try {
      await query(
        'INSERT INTO link_review_queue (customer_id, owner_user_id, email_user_id, phone_user_id, customer_email, customer_phone, reason) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          customer.id,
          ownerUserId,
          emailUser,
          phoneUser,
          customer.email,
          customer.phone,
          'email_phone_user_conflict',
        ],
      );
    } catch (error) {
      console.warn('[linking] conflict queue unavailable', error);
    }

    await query('UPDATE customers SET linked_user_id = NULL WHERE id = $1', [customer.id]);
    console.warn('[linking] conflict customer', customer.id);
    return null;
  }

  const target = phoneUser ?? emailUser;

  if (!target) {
    if (customer.linked_user_id) {
      await query('UPDATE customers SET linked_user_id = NULL WHERE id = $1', [customer.id]);
    }
    return null;
  }

  await query('UPDATE customers SET linked_user_id = $1 WHERE id = $2', [target, customer.id]);
  return target;
}

export async function relinkCustomersForUser(userId: string): Promise<number> {
  const userResult = await query('SELECT email, phone FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  if (!user) {
    return 0;
  }

  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const normalizedPhone = normalizePhone(user.phone);
  const emailParam = email !== '' ? email : null;
  const phoneParam = normalizedPhone !== '' ? normalizedPhone : null;

  const customersResult = await query(
    'SELECT id FROM customers WHERE linked_user_id IS NULL AND deleted_at IS NULL AND owner_user_id <> $1 AND (($2::text IS NOT NULL AND lower(email) = lower($2)) OR ($3::text IS NOT NULL AND fn_norm_phone(phone) = $3))',
    [userId, emailParam, phoneParam],
  );

  let count = 0;
  for (const customer of customersResult.rows) {
    if (await linkCustomer(customer.id)) {
      count += 1;
    }
  }

  return count;
}
