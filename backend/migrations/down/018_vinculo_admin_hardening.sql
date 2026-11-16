DROP INDEX IF EXISTS idx_sponsor_creatives_media_id;
DROP INDEX IF EXISTS idx_sponsor_contracts_created_by;
DROP INDEX IF EXISTS idx_sponsor_contracts_renovado_de;
DROP INDEX IF EXISTS idx_sponsor_contracts_sponsor_id;
DROP INDEX IF EXISTS idx_plan_promotion_users_user_id;
DROP INDEX IF EXISTS idx_email_confirmation_tokens_user_id;
DROP INDEX IF EXISTS idx_transactions_applies_to_transaction_id;
DROP INDEX IF EXISTS idx_transaction_events_actor_user_id;
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;
DROP INDEX IF EXISTS idx_ai_interactions_user_id;

DROP INDEX IF EXISTS uq_customers_owner_phone_active;
DROP INDEX IF EXISTS uq_customers_owner_email_active;

DROP TABLE IF EXISTS link_review_queue;

ALTER TABLE users
    DROP COLUMN IF EXISTS phone_verified_at;
