-- Modelo de plano: Free, Pro e Enterprise.
-- Idempotente. Não apaga assinatura nem usuário.
-- Enterprise fica no banco. Esta migration não abre checkout.
-- O down manual está em backend/migrations/down/ e o deploy não executa essa pasta.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grant_plan TEXT;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grant_source TEXT;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grant_expires_at TIMESTAMPTZ;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS granted_by UUID;

-- O plano pago continua em plan/status/current_period_end.
-- A concessão (cortesia, teste, cupom, promoção) fica ao lado e expira sozinha.
DO $$
DECLARE
  cname text;
  def text;
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE EXCEPTION 'Tabela subscriptions ausente. Rode a migration 006 antes.';
  END IF;

  SELECT conname, pg_get_constraintdef(oid)
    INTO cname, def
    FROM pg_constraint
   WHERE conrelid = 'public.subscriptions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%plan%'
     AND pg_get_constraintdef(oid) NOT ILIKE '%grant%'
   ORDER BY conname
   LIMIT 1;

  IF cname IS NULL THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE'));
  ELSIF def NOT ILIKE '%ENTERPRISE%' THEN
    EXECUTE format('ALTER TABLE subscriptions DROP CONSTRAINT %I', cname);
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_grant_plan_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_grant_plan_check
      CHECK (grant_plan IS NULL OR grant_plan IN ('PRO', 'ENTERPRISE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_grant_source_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_grant_source_check
      CHECK (
        grant_source IS NULL
        OR grant_source IN ('cortesia', 'trial', 'cupom', 'promocao')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plan_promotions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan        TEXT NOT NULL CHECK (plan IN ('PRO', 'ENTERPRISE')),
  source      TEXT NOT NULL CHECK (source IN ('cortesia', 'trial', 'cupom', 'promocao')),
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  audience    TEXT NOT NULL CHECK (audience IN ('all', 'selected')),
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_promotion_users (
  promotion_id UUID NOT NULL REFERENCES plan_promotions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_promotions_expires_at
  ON plan_promotions (expires_at);
