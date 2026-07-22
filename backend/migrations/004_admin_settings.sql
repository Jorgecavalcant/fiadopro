-- =================================================================
-- FIADO PRO — Migration 004 (frente ADMIN)
-- app_settings: configurações administrativas chave/valor (JSON)
-- Idempotente: seguro rodar múltiplas vezes.
-- =================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reaproveita a função update_timestamp() criada em db-init.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
    EXECUTE 'CREATE OR REPLACE TRIGGER trg_app_settings_updated_at
      BEFORE UPDATE ON app_settings
      FOR EACH ROW EXECUTE FUNCTION update_timestamp()';
  END IF;
END $$;
