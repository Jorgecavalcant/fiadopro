-- Rollback manual. O deploy NÃO executa esta pasta.
-- Apaga o registro de auditoria e as colunas de bloqueio.
-- Não restaura o conteúdo: para voltar os dados, use o pg_dump feito antes do deploy.

DROP INDEX IF EXISTS admin_audit_log_action_idx;
DROP INDEX IF EXISTS admin_audit_log_created_at_idx;
DROP TABLE IF EXISTS admin_audit_log;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_block_reason_check;

ALTER TABLE users
  DROP COLUMN IF EXISTS block_reason,
  DROP COLUMN IF EXISTS block_note,
  DROP COLUMN IF EXISTS blocked_by,
  DROP COLUMN IF EXISTS blocked_at,
  DROP COLUMN IF EXISTS legal_hold;
