-- =================================================================
-- 002 — Dados de negócio no servidor (customers + transactions)
-- Fonte de verdade passa a ser o PostgreSQL; localStorage vira cache.
-- =================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS pix_key VARCHAR(140) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS customers (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    name                 VARCHAR(255) NOT NULL,
    phone                VARCHAR(30) NOT NULL,
    email                VARCHAR(255),
    pix_key              VARCHAR(140),
    trusted              BOOLEAN NOT NULL DEFAULT FALSE,
    overpayment_strategy TEXT NOT NULL DEFAULT 'RETURN',
    notes                JSONB NOT NULL DEFAULT '[]',
    score                INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_owner  ON customers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_linked ON customers(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone  ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email  ON customers(email);

CREATE TABLE IF NOT EXISTS transactions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id          UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    owner_user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                 TEXT NOT NULL CHECK (type IN ('DEBT','PAYMENT','REFUND','ABATIMENTO')),
    status               TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','PENDING','REJECTED')),
    amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description          TEXT NOT NULL DEFAULT '',
    occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date             TIMESTAMPTZ,
    payment_method       TEXT,
    attachment           JSONB,
    installment_number   INTEGER,
    total_installments   INTEGER,
    installment_group_id UUID,
    interest_rate        NUMERIC(5,2),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner    ON transactions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status   ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(occurred_at);

CREATE OR REPLACE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
