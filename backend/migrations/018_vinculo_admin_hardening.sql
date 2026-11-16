ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS link_review_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
    owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    email_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    phone_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    customer_email TEXT,
    customer_phone TEXT,
    reason TEXT NOT NULL DEFAULT 'email_phone_user_conflict',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL
);

-- Reconcile active duplicate emails before enforcing uniqueness. Keep the oldest
-- customer (created_at, then id); soft-delete all other active records.
DO $$
DECLARE
    duplicate_group RECORD;
BEGIN
    FOR duplicate_group IN
        SELECT owner_user_id, lower(btrim(email)) AS normalized_email,
               (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS keeper_id
          FROM customers
         WHERE deleted_at IS NULL
           AND email IS NOT NULL
           AND btrim(email) <> ''
         GROUP BY owner_user_id, lower(btrim(email))
        HAVING count(*) > 1
    LOOP
        INSERT INTO link_review_queue
            (customer_id, owner_user_id, reason, customer_email, customer_phone)
        SELECT duplicate_group.keeper_id, duplicate_group.owner_user_id,
               'duplicate_email_reconcile', keeper.email, keeper.phone
          FROM customers AS keeper
         WHERE keeper.id = duplicate_group.keeper_id;

        UPDATE customers
           SET deleted_at = NOW()
         WHERE owner_user_id IS NOT DISTINCT FROM duplicate_group.owner_user_id
           AND deleted_at IS NULL
           AND email IS NOT NULL
           AND btrim(email) <> ''
           AND lower(btrim(email)) = duplicate_group.normalized_email
           AND id <> duplicate_group.keeper_id;
    END LOOP;
END $$;

-- Reconcile active duplicate normalized phones before enforcing uniqueness.
DO $$
DECLARE
    duplicate_group RECORD;
BEGIN
    FOR duplicate_group IN
        SELECT c.owner_user_id, fn_norm_phone(c.phone) AS normalized_phone,
               (array_agg(
                   c.id
                   ORDER BY
                       CASE
                           WHEN c.email IS NULL OR btrim(c.email) = '' THEN 0
                           WHEN (
                               SELECT count(*)
                                 FROM customers AS email_customer
                                WHERE email_customer.owner_user_id IS NOT DISTINCT FROM c.owner_user_id
                                  AND email_customer.deleted_at IS NULL
                                  AND email_customer.email IS NOT NULL
                                  AND btrim(email_customer.email) <> ''
                                  AND lower(btrim(email_customer.email)) = lower(btrim(c.email))
                           ) = 1 THEN 0
                           ELSE 1
                       END ASC,
                       c.created_at ASC,
                       c.id ASC
               ))[1] AS keeper_id
          FROM customers AS c
         WHERE c.deleted_at IS NULL
           AND fn_norm_phone(c.phone) <> ''
         GROUP BY c.owner_user_id, fn_norm_phone(c.phone)
        HAVING count(*) > 1
    LOOP
        INSERT INTO link_review_queue
            (customer_id, owner_user_id, reason, customer_email, customer_phone)
        SELECT duplicate_group.keeper_id, duplicate_group.owner_user_id,
               'duplicate_phone_reconcile', keeper.email, keeper.phone
          FROM customers AS keeper
         WHERE keeper.id = duplicate_group.keeper_id;

        UPDATE customers
           SET deleted_at = NOW()
         WHERE owner_user_id IS NOT DISTINCT FROM duplicate_group.owner_user_id
           AND deleted_at IS NULL
           AND fn_norm_phone(phone) = duplicate_group.normalized_phone
           AND fn_norm_phone(phone) <> ''
           AND id <> duplicate_group.keeper_id;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_owner_email_active
    ON customers (owner_user_id, lower(btrim(email)))
    WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_owner_phone_active
    ON customers (owner_user_id, fn_norm_phone(phone))
    WHERE deleted_at IS NULL AND fn_norm_phone(phone) <> '';

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id
    ON ai_interactions (user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_events_actor_user_id
    ON transaction_events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_applies_to_transaction_id
    ON transactions (applies_to_transaction_id);

CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_user_id
    ON email_confirmation_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_plan_promotion_users_user_id
    ON plan_promotion_users (user_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_sponsor_id
    ON sponsor_contracts (sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_renovado_de
    ON sponsor_contracts (renovado_de);

CREATE INDEX IF NOT EXISTS idx_sponsor_contracts_created_by
    ON sponsor_contracts (created_by);

CREATE INDEX IF NOT EXISTS idx_sponsor_creatives_media_id
    ON sponsor_creatives (media_id);

-- A aplicação usa ADMIN_EMAIL; não hardcode emails nem demova admins nesta migration.