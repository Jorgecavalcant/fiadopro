-- Eventos de webhook já processados. O mesmo id não muda o plano de novo.
-- Idempotente. Não apaga assinatura. O down manual está em migrations/down/.

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);
