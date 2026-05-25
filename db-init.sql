-- =================================================================
-- FIADO PRO — Initial Database Schema
-- =================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== USERS =====
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    avatar_url  VARCHAR(500),
    phone       VARCHAR(20),
    cpf         VARCHAR(14) UNIQUE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ===== DEBTS =====
CREATE TABLE IF NOT EXISTS debts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creditor_name   VARCHAR(255) NOT NULL,
    original_amount DECIMAL(12,2) NOT NULL,
    current_amount  DECIMAL(12,2) NOT NULL,
    due_date        DATE NOT NULL,
    status          VARCHAR(50) DEFAULT 'active',
    interest_rate   DECIMAL(5,2),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status  ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);

-- ===== PAYMENTS =====
CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id         UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    payment_date    DATE NOT NULL,
    payment_method  VARCHAR(50),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_debt_id ON payments(debt_id);

-- ===== AI INTERACTIONS =====
CREATE TABLE IF NOT EXISTS ai_interactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt      TEXT NOT NULL,
    response    TEXT NOT NULL,
    tokens_used INTEGER,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== TRIGGER updated_at =====
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE TRIGGER trg_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ===== SEED (teste) =====
INSERT INTO users (email, password_hash, full_name)
VALUES ('teste@fiadopro.com', '$2b$12$M5N9Y7p0X1V4Q3R8T6U2OexampleHashForTest123456789012', 'Usuário Teste')
ON CONFLICT (email) DO NOTHING;
