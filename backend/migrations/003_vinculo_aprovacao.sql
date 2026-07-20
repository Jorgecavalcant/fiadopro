-- =================================================================
-- 003 — Vínculo cliente↔usuário e trilha de aprovação de lançamentos
-- =================================================================

-- Normalização de telefone BR no banco (espelha utils/phone.ts):
-- só dígitos; remove DDI 55 quando presente; remove 0 de tronco.
CREATE OR REPLACE FUNCTION fn_norm_phone(raw TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN d = '' THEN ''
    WHEN length(d) >= 12 AND d LIKE '55%' THEN ltrim(substring(d FROM 3), '0')
    ELSE ltrim(d, '0')
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g') AS d) t;
$$;

CREATE INDEX IF NOT EXISTS idx_customers_phone_norm ON customers (fn_norm_phone(phone));
CREATE INDEX IF NOT EXISTS idx_users_phone_norm     ON users (fn_norm_phone(phone));

CREATE TABLE IF NOT EXISTS transaction_events (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    actor_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action         TEXT NOT NULL CHECK (action IN ('CREATED','APPROVED','REJECTED','RESENT')),
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_events_tx ON transaction_events(transaction_id);
