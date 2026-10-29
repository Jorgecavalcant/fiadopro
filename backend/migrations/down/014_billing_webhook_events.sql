-- Rollback manual. O deploy NÃO executa esta pasta.
-- Apaga só a tabela de eventos já vistos. Não apaga assinatura nem usuário.

DROP TABLE IF EXISTS billing_webhook_events;
