-- Conta encerrada fica reativável por 30 dias.
-- login_retained nasce false: contas já anonimizadas não voltam.
-- Só o encerramento novo grava true. Nada aqui apaga linha.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_retained boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_purge_after_pending
  ON users (purge_after)
  WHERE deleted_at IS NOT NULL AND purge_completed_at IS NULL;

-- Amplia o status do lançamento para CANCELLED só se a regra ainda não aceita.
-- Não reescreve linhas existentes.
DO $$
DECLARE
  cname text;
  def text;
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname, pg_get_constraintdef(oid)
    INTO cname, def
    FROM pg_constraint
   WHERE conrelid = 'public.transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%'
     AND pg_get_constraintdef(oid) ILIKE '%PENDING%'
   ORDER BY conname
   LIMIT 1;

  IF cname IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'transactions'
         AND column_name = 'status'
    ) THEN
      ALTER TABLE transactions
        ADD CONSTRAINT transactions_status_check
        CHECK (status IN ('CONFIRMED', 'PENDING', 'REJECTED', 'CANCELLED'));
    END IF;
  ELSIF def NOT ILIKE '%CANCELLED%' THEN
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', cname);
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('CONFIRMED', 'PENDING', 'REJECTED', 'CANCELLED'));
  END IF;
END $$;

-- O cancelamento grava um evento CANCELLED. A trilha antiga só aceitava
-- CREATED, APPROVED, REJECTED e RESENT.
DO $$
DECLARE
  cname text;
  def text;
BEGIN
  IF to_regclass('public.transaction_events') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname, pg_get_constraintdef(oid)
    INTO cname, def
    FROM pg_constraint
   WHERE conrelid = 'public.transaction_events'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%action%'
     AND pg_get_constraintdef(oid) ILIKE '%CREATED%'
   ORDER BY conname
   LIMIT 1;

  IF cname IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'transaction_events'
         AND column_name = 'action'
    ) THEN
      ALTER TABLE transaction_events
        ADD CONSTRAINT transaction_events_action_check
        CHECK (action IN ('CREATED', 'APPROVED', 'REJECTED', 'RESENT', 'CANCELLED'));
    END IF;
  ELSIF def NOT ILIKE '%CANCELLED%' THEN
    EXECUTE format('ALTER TABLE transaction_events DROP CONSTRAINT %I', cname);
    ALTER TABLE transaction_events
      ADD CONSTRAINT transaction_events_action_check
      CHECK (action IN ('CREATED', 'APPROVED', 'REJECTED', 'RESENT', 'CANCELLED'));
  END IF;
END $$;
