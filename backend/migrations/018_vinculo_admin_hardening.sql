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

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_owner_email_active
    ON customers (owner_user_id, lower(email))
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
