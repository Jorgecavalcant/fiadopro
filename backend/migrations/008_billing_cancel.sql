-- =================================================================
-- Migration 008 — Cancelamento de assinatura (com carência)
-- Idempotente.
--
-- canceled_at marca que o usuário pediu cancelamento; plan/status/
-- current_period_end NÃO são tocados no cancelamento — getUserPlan()
-- já expira o PRO sozinho quando current_period_end passar, então o
-- usuário mantém acesso pelos dias que já pagou (carência natural).
-- =================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
