-- Destructive Fiado Pro data reset. This file is NOT run automatically.
-- The caller must set app.allow_fiado_reset to YES_RESET_FIADO_PRO.
--
-- Preserved tables:
--   schema_migrations: migration ledger; deleting it can break schema management.
--   app_settings and ai_config: system configuration.
--   plan_promotions: commercial promotion catalog.
--
-- Take a database backup before running this reset.

BEGIN;

DO $$
BEGIN
  IF current_setting('app.allow_fiado_reset', true) IS DISTINCT FROM 'YES_RESET_FIADO_PRO' THEN
    RAISE EXCEPTION
      'Fiado Pro reset refused: set app.allow_fiado_reset to YES_RESET_FIADO_PRO to authorize it';
  END IF;
END
$$;

-- Truncate the listed data tables together so foreign-key relationships among
-- them are handled safely. CASCADE may also truncate other tables that
-- reference these tables; review the schema before authorizing this reset.
TRUNCATE TABLE
  users,
  customers,
  transactions,
  transaction_events,
  debts,
  payments,
  ai_interactions,
  password_reset_tokens,
  email_confirmation_tokens,
  subscriptions,
  billing_webhook_events,
  admin_audit_log,
  sponsors,
  sponsor_contracts,
  sponsor_creatives,
  sponsor_events,
  sponsor_fullscreen_seen,
  sponsor_media,
  sponsor_contract_documents,
  plan_promotion_users,
  link_review_queue
RESTART IDENTITY CASCADE;

COMMIT;
