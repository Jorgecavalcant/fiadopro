-- Bloqueio com motivo e registro das ações do admin.
-- Retenção: 5 anos. Bloqueio judicial fica enquanto a ordem valer;
-- ao liberar, o prazo de 5 anos começa a contar (retain_until).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS block_reason text,
  ADD COLUMN IF NOT EXISTS block_note text,
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold boolean NOT NULL DEFAULT false;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_block_reason_check;

ALTER TABLE users
  ADD CONSTRAINT users_block_reason_check
  CHECK (
    block_reason IS NULL
    OR block_reason IN ('judicial', 'fraude', 'pedido_do_usuario', 'outro')
  );

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  reason text,
  note text,
  before_state jsonb,
  after_state jsonb,
  retain_until timestamptz
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON admin_audit_log (action);
