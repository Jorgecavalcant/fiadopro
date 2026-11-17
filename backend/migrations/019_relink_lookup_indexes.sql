-- 019: índices aditivos para re-vínculo leve (sem alterar dados existentes)
CREATE INDEX IF NOT EXISTS idx_users_lower_email_active
    ON users (lower(email))
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_norm_phone_active
    ON users (fn_norm_phone(phone))
    WHERE deleted_at IS NULL
      AND is_active = TRUE
      AND fn_norm_phone(phone) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_unlinked_email
    ON customers (lower(email))
    WHERE linked_user_id IS NULL
      AND deleted_at IS NULL
      AND email IS NOT NULL
      AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_unlinked_phone
    ON customers (fn_norm_phone(phone))
    WHERE linked_user_id IS NULL
      AND deleted_at IS NULL
      AND fn_norm_phone(phone) <> '';
