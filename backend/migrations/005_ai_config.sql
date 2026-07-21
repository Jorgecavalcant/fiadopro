-- Frente IA — configuração de modelos OpenRouter (editável via /api/admin/ai-config)
CREATE TABLE IF NOT EXISTS ai_config (
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chat_model   TEXT NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
  vision_model TEXT NOT NULL DEFAULT 'qwen/qwen-2.5-vl-72b-instruct:free',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotente: garante a linha única (id=1) sem sobrescrever configuração já ajustada.
INSERT INTO ai_config (id, chat_model, vision_model, enabled)
VALUES (1, 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-vl-72b-instruct:free', TRUE)
ON CONFLICT (id) DO NOTHING;
