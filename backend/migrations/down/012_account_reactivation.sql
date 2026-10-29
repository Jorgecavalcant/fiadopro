-- Rollback manual. O deploy NÃO executa esta pasta.
-- Remove a coluna login_retained e o índice da fila de purge.
-- A constraint antiga de status só volta se NÃO existir lançamento CANCELLED.
-- A constraint antiga do evento só volta se NÃO existir evento CANCELLED.
-- Este script não apaga lançamentos.

DROP INDEX IF EXISTS idx_users_purge_after_pending;

ALTER TABLE users DROP COLUMN IF EXISTS login_retained;

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM transactions WHERE status = 'CANCELLED') THEN
    RAISE NOTICE 'Há lançamento CANCELLED: a constraint antiga de status não foi restaurada.';
  ELSE
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('CONFIRMED', 'PENDING', 'REJECTED'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transaction_events') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM transaction_events WHERE action = 'CANCELLED') THEN
    RAISE NOTICE 'Há evento CANCELLED: a constraint antiga da trilha não foi restaurada.';
  ELSE
    ALTER TABLE transaction_events DROP CONSTRAINT IF EXISTS transaction_events_action_check;
    ALTER TABLE transaction_events
      ADD CONSTRAINT transaction_events_action_check
      CHECK (action IN ('CREATED', 'APPROVED', 'REJECTED', 'RESENT'));
  END IF;
END $$;
