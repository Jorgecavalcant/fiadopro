-- Patrocinadores locais. Só adiciona tabelas. Não mexe em usuário, plano ou lançamento.
-- Idempotente. O deploy não executa a pasta down.

CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 80),
  categoria text NOT NULL CHECK (char_length(categoria) BETWEEN 1 AND 40),
  cidade text NOT NULL CHECK (char_length(cidade) BETWEEN 1 AND 80),
  contato_nome text CHECK (contato_nome IS NULL OR char_length(contato_nome) BETWEEN 1 AND 80),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id),
  inicio date NOT NULL,
  fim date NOT NULL,
  planos_alvo text[] NOT NULL,
  slots text[] NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  valor_centavos integer,
  observacao text,
  renovado_de uuid REFERENCES sponsor_contracts(id),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_contracts_dates_check CHECK (fim >= inicio),
  CONSTRAINT sponsor_contracts_status_check CHECK (
    status IN ('rascunho', 'ativo', 'pausado', 'vencido', 'cancelado')
  ),
  CONSTRAINT sponsor_contracts_planos_check CHECK (
    cardinality(planos_alvo) > 0 AND planos_alvo <@ ARRAY['free', 'pro']::text[]
  ),
  CONSTRAINT sponsor_contracts_slots_check CHECK (
    cardinality(slots) > 0 AND slots <@ ARRAY['faixa', 'tela_cheia']::text[]
  ),
  CONSTRAINT sponsor_contracts_valor_check CHECK (valor_centavos IS NULL OR valor_centavos >= 0),
  CONSTRAINT sponsor_contracts_obs_check CHECK (observacao IS NULL OR char_length(observacao) <= 280)
);

CREATE TABLE IF NOT EXISTS sponsor_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES sponsor_contracts(id),
  tipo text NOT NULL,
  slot text NOT NULL,
  media_url text NOT NULL CHECK (char_length(media_url) BETWEEN 12 AND 500),
  media_origem text NOT NULL DEFAULT 'link',
  link_destino text NOT NULL CHECK (char_length(link_destino) BETWEEN 12 AND 500),
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 80),
  texto_alt text NOT NULL CHECK (char_length(texto_alt) BETWEEN 1 AND 160),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_creatives_tipo_check CHECK (tipo IN ('imagem', 'video')),
  CONSTRAINT sponsor_creatives_slot_check CHECK (slot IN ('faixa', 'tela_cheia')),
  CONSTRAINT sponsor_creatives_origem_check CHECK (media_origem = 'link')
);

CREATE TABLE IF NOT EXISTS sponsor_events (
  creative_id uuid NOT NULL REFERENCES sponsor_creatives(id),
  contract_id uuid NOT NULL REFERENCES sponsor_contracts(id),
  tipo text NOT NULL,
  slot text NOT NULL,
  plano text NOT NULL,
  dia date NOT NULL,
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  PRIMARY KEY (creative_id, contract_id, tipo, slot, plano, dia),
  CONSTRAINT sponsor_events_tipo_check CHECK (tipo IN ('exibicao', 'clique')),
  CONSTRAINT sponsor_events_slot_check CHECK (slot IN ('faixa', 'tela_cheia')),
  CONSTRAINT sponsor_events_plano_check CHECK (plano IN ('free', 'pro'))
);

CREATE TABLE IF NOT EXISTS sponsor_fullscreen_seen (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dia date NOT NULL,
  turno text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dia, turno),
  CONSTRAINT sponsor_fullscreen_turno_check CHECK (turno IN ('manha', 'tarde', 'noite'))
);

CREATE INDEX IF NOT EXISTS sponsor_contracts_live_idx
  ON sponsor_contracts (status, inicio, fim);

CREATE INDEX IF NOT EXISTS sponsor_creatives_slot_idx
  ON sponsor_creatives (contract_id, slot);

CREATE INDEX IF NOT EXISTS sponsor_events_report_idx
  ON sponsor_events (contract_id, dia);
