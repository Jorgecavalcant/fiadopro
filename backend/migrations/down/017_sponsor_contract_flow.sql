-- Rollback manual. O deploy NÃO executa esta pasta.
-- Remove só o que a 017 adicionou. Não mexe em usuário, papel ou lançamento.

DROP TABLE IF EXISTS sponsor_contract_documents;

ALTER TABLE sponsor_creatives DROP CONSTRAINT IF EXISTS sponsor_creatives_zoom_check;
ALTER TABLE sponsor_creatives DROP COLUMN IF EXISTS enquadramento_y;
ALTER TABLE sponsor_creatives DROP COLUMN IF EXISTS enquadramento_x;
ALTER TABLE sponsor_creatives DROP COLUMN IF EXISTS enquadramento_zoom;
ALTER TABLE sponsor_creatives DROP COLUMN IF EXISTS media_id;

DROP TABLE IF EXISTS sponsor_media;

UPDATE sponsor_creatives SET media_origem = 'link' WHERE media_origem <> 'link';
ALTER TABLE sponsor_creatives DROP CONSTRAINT IF EXISTS sponsor_creatives_origem_check;
ALTER TABLE sponsor_creatives
  ADD CONSTRAINT sponsor_creatives_origem_check
  CHECK (media_origem = 'link');

ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_aviso_check;
ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_vencimento_check;
ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_parcelas_check;
ALTER TABLE sponsor_contracts DROP CONSTRAINT IF EXISTS sponsor_contracts_pagamento_check;
ALTER TABLE sponsor_contracts DROP COLUMN IF EXISTS aviso_previo_dias;
ALTER TABLE sponsor_contracts DROP COLUMN IF EXISTS dia_vencimento;
ALTER TABLE sponsor_contracts DROP COLUMN IF EXISTS parcelas;
ALTER TABLE sponsor_contracts DROP COLUMN IF EXISTS forma_pagamento;

ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_documento_check;
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_tipo_pessoa_check;
ALTER TABLE sponsors DROP COLUMN IF EXISTS email;
ALTER TABLE sponsors DROP COLUMN IF EXISTS telefone;
ALTER TABLE sponsors DROP COLUMN IF EXISTS representante_cargo;
ALTER TABLE sponsors DROP COLUMN IF EXISTS representante_nome;
ALTER TABLE sponsors DROP COLUMN IF EXISTS uf;
ALTER TABLE sponsors DROP COLUMN IF EXISTS endereco;
ALTER TABLE sponsors DROP COLUMN IF EXISTS documento;
ALTER TABLE sponsors DROP COLUMN IF EXISTS razao_social;
ALTER TABLE sponsors DROP COLUMN IF EXISTS tipo_pessoa;
