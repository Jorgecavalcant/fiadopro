-- Rollback manual. O deploy NÃO executa esta pasta.
-- Remove a tabela de tokens e as colunas de confirmação.
-- Não apaga usuários.

DROP TABLE IF EXISTS email_confirmation_tokens;

ALTER TABLE users DROP COLUMN IF EXISTS email_confirmed_at;

ALTER TABLE users DROP COLUMN IF EXISTS email_confirmation_required;
