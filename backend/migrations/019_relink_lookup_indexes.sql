-- 019 — Índices aditivos para relink barato no login (sem DROP, sem backfill).
-- Complementa idx_customers_phone_norm / idx_users_phone_norm da 003.
-- Jorge: revisar antes do merge/deploy.

CREATE INDEX IF NOT EXISTS idx_customers_unlinked_phone_norm
  ON customers (fn_norm_phone(phone))
  WHERE linked_user_id IS NULL
    AND deleted_at IS NULL
    AND fn_norm_phone(phone) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_unlinked_email_lower
  ON customers (lower(email))
  WHERE linked_user_id IS NULL
    AND deleted_at IS NULL
    AND email IS NOT NULL
    AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_email_lower
  ON customers (lower(email))
  WHERE deleted_at IS NULL
    AND email IS NOT NULL
    AND btrim(email) <> '';
