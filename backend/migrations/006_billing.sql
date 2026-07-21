-- =================================================================
-- Migration 006 — Frente BILLING (Asaas)
-- Idempotente: seguro rodar mais de uma vez.
-- =================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan                   TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO')),
    asaas_customer_id      TEXT,
    asaas_subscription_id  TEXT,
    status                 TEXT,
    current_period_end     TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
    ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription_id
    ON subscriptions(asaas_subscription_id);
