ALTER TABLE users
  ADD COLUMN IF NOT EXISTS purge_after timestamptz,
  ADD COLUMN IF NOT EXISTS purge_completed_at timestamptz;
