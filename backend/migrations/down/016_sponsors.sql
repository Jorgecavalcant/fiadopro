-- Rollback manual. O deploy não executa esta pasta.
-- Remove só as tabelas de patrocínio. Não apaga usuário nem lançamento.

DROP TABLE IF EXISTS sponsor_fullscreen_seen;
DROP TABLE IF EXISTS sponsor_events;
DROP TABLE IF EXISTS sponsor_creatives;
DROP TABLE IF EXISTS sponsor_contracts;
DROP TABLE IF EXISTS sponsors;
