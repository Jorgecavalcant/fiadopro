-- Confirmação de e-mail no cadastro. Aditiva e idempotente.
-- Não apaga usuário. Rodar de novo não falha.
-- O deploy aplica só os arquivos desta pasta, não a pasta down.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_confirmation_required boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS email_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS email_confirmation_tokens_hash_idx
  ON email_confirmation_tokens (token_hash);
