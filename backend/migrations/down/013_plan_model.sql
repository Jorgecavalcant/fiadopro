-- Rollback manual. O deploy NÃO executa esta pasta.
-- Remove concessão, promoção e a marca de teste grátis.
-- Não apaga usuários nem a linha de assinatura.
-- A trava antiga (só FREE e PRO) só volta se ninguém estiver em ENTERPRISE.

DROP TABLE IF EXISTS plan_promotion_users;
DROP TABLE IF EXISTS plan_promotions;

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_grant_plan_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_grant_source_check;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS grant_plan;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS grant_source;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS grant_expires_at;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS granted_by;

ALTER TABLE users DROP COLUMN IF EXISTS trial_used_at;

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM subscriptions WHERE plan = 'ENTERPRISE') THEN
    RAISE NOTICE 'Há assinatura ENTERPRISE: a trava antiga de plano não foi restaurada.';
  ELSE
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('FREE', 'PRO'));
  END IF;
END $$;
