-- Fluxo do patrocínio: dados do contrato, arte no banco e versão do PDF.
-- Só adiciona. Não mexe em usuário, papel ou lançamento.
-- Idempotente. O deploy não executa a pasta down.

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS tipo_pessoa text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS documento text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS representante_nome text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS representante_cargo text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_tipo_pessoa_check;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_tipo_pessoa_check
  CHECK (tipo_pessoa IS NULL OR tipo_pessoa IN ('pj', 'pf'));

ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_documento_check;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_documento_check
  CHECK (documento IS NULL OR documento ~ '^[0-9]{11}$' OR documento ~ '^[0-9]{14}$');

ALTER TABLE sponsor_contracts ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE sponsor_contracts ADD COLUMN IF NOT EXISTS parcelas integer;
ALTER TABLE sponsor_contracts ADD COLUMN IF NOT EXISTS dia_vencimento integer;
ALTER TABLE sponsor_contracts ADD COLUMN IF NOT EXISTS aviso_previo_dias integer NOT NULL DEFAULT 15;

ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_pagamento_check;
ALTER TABLE sponsor_contracts
  ADD CONSTRAINT sponsor_contracts_pagamento_check
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN ('pix', 'boleto', 'transferencia')
  );

ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_parcelas_check;
ALTER TABLE sponsor_contracts
  ADD CONSTRAINT sponsor_contracts_parcelas_check
  CHECK (parcelas IS NULL OR (parcelas >= 1 AND parcelas <= 36));

ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_vencimento_check;
ALTER TABLE sponsor_contracts
  ADD CONSTRAINT sponsor_contracts_vencimento_check
  CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 28));

ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_aviso_check;
ALTER TABLE sponsor_contracts
  ADD CONSTRAINT sponsor_contracts_aviso_check
  CHECK (aviso_previo_dias >= 1 AND aviso_previo_dias <= 90);

CREATE TABLE IF NOT EXISTS sponsor_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo bytea NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  largura integer NOT NULL,
  altura integer NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_media_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT sponsor_media_size_check CHECK (byte_size > 0 AND byte_size <= 2097152),
  CONSTRAINT sponsor_media_dim_check CHECK (largura BETWEEN 1 AND 4000 AND altura BETWEEN 1 AND 4000),
  CONSTRAINT sponsor_media_hash_check CHECK (char_length(sha256) = 64)
);

ALTER TABLE sponsor_creatives ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES sponsor_media(id);
ALTER TABLE sponsor_creatives ADD COLUMN IF NOT EXISTS enquadramento_zoom numeric NOT NULL DEFAULT 1;
ALTER TABLE sponsor_creatives ADD COLUMN IF NOT EXISTS enquadramento_x numeric NOT NULL DEFAULT 50;
ALTER TABLE sponsor_creatives ADD COLUMN IF NOT EXISTS enquadramento_y numeric NOT NULL DEFAULT 50;

ALTER TABLE sponsor_creatives DROP CONSTRAINT IF EXISTS sponsor_creatives_origem_check;
ALTER TABLE sponsor_creatives
  ADD CONSTRAINT sponsor_creatives_origem_check
  CHECK (media_origem IN ('link', 'upload'));

ALTER TABLE sponsor_creatives DROP CONSTRAINT IF EXISTS sponsor_creatives_zoom_check;
ALTER TABLE sponsor_creatives
  ADD CONSTRAINT sponsor_creatives_zoom_check
  CHECK (
    enquadramento_zoom >= 1
    AND enquadramento_zoom <= 3
    AND enquadramento_x >= 0
    AND enquadramento_x <= 100
    AND enquadramento_y >= 0
    AND enquadramento_y <= 100
  );

CREATE TABLE IF NOT EXISTS sponsor_contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES sponsor_contracts(id),
  versao integer NOT NULL,
  pdf_sha256 text NOT NULL,
  snapshot jsonb NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_contract_documents_versao_check CHECK (versao > 0),
  CONSTRAINT sponsor_contract_documents_hash_check CHECK (char_length(pdf_sha256) = 64),
  CONSTRAINT sponsor_contract_documents_unique UNIQUE (contract_id, versao)
);
