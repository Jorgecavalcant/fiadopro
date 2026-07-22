-- =================================================================
-- Migration 009 — Pagamento iniciado pelo devedor (contraparte)
-- Idempotente.
--
-- Até aqui, só o dono do cadastro (owner_user_id) cria lançamentos.
-- Agora o usuário vinculado (linked_user_id) também pode criar um
-- PAYMENT/ABATIMENTO/REFUND contra si mesmo — precisa dizer quem
-- criou de fato para approve/reject/resend saberem para qual lado
-- a aprovação deve ir.
-- =================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS applies_to_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Backfill: todo lançamento existente foi criado pelo dono.
UPDATE transactions SET created_by_user_id = owner_user_id WHERE created_by_user_id IS NULL;

ALTER TABLE transactions
  ALTER COLUMN created_by_user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by_user_id);
