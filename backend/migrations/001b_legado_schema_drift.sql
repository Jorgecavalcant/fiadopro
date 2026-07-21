-- =================================================================
-- 001b — Codifica o drift de schema feito manualmente em produção
-- (abr/2026: Google OAuth, consentimento LGPD, reset de senha).
-- Sem isto, um banco novo (staging/instalação limpa) quebra no
-- registro. Em produção é no-op (tudo IF NOT EXISTS / já aplicado).
-- =================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip VARCHAR(45);

-- Usuários Google não têm senha local
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users(google_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token);
