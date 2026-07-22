-- =================================================================
-- Normaliza e-mails (trim + lowercase) e cria indice unico
-- case-insensitive para evitar contas duplicadas (Jorge@Gmail.com
-- vs jorge@gmail.com).
--
-- Idempotente: pode ser executada novamente sem erro.
-- Nao aborta o deploy por causa de colisoes isoladas: pares de
-- e-mail que so diferem na capitalizacao NAO sao normalizados
-- automaticamente (evita violar unicidade / mesclar contas sem
-- intervencao humana) — apenas os e-mails que ficam unicos apos a
-- normalizacao sao atualizados. Colisoes remanescentes sao
-- reportadas via RAISE NOTICE/WARNING para o integrador resolver
-- manualmente.
-- =================================================================

-- 1) Detecta e loga (sem abortar) grupos de usuarios cujo e-mail
--    colidiria apos normalizacao (LOWER(TRIM(email))).
DO $$
DECLARE
  collision RECORD;
  collision_groups INTEGER := 0;
BEGIN
  FOR collision IN
    SELECT
      LOWER(TRIM(email)) AS normalized_email,
      array_agg(id ORDER BY created_at)    AS user_ids,
      array_agg(email ORDER BY created_at) AS original_emails,
      COUNT(*) AS total
    FROM users
    WHERE deleted_at IS NULL
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  LOOP
    collision_groups := collision_groups + 1;
    RAISE NOTICE
      'Colisao de e-mail apos normalizacao (requer intervencao manual do CEO/integrador) - normalizado="%", usuarios=%, e-mails_originais=%',
      collision.normalized_email, collision.user_ids, collision.original_emails;
  END LOOP;

  IF collision_groups > 0 THEN
    RAISE NOTICE
      'Total de % grupo(s) de e-mail colidentes NAO normalizados automaticamente. Resolva manualmente (mesclar/renomear contas) e rode esta migration novamente.',
      collision_groups;
  ELSE
    RAISE NOTICE 'Nenhuma colisao de e-mail case-insensitive encontrada.';
  END IF;
END $$;

-- 2) Normaliza (trim + lowercase) somente os e-mails que NAO colidem
--    com outro usuario apos a normalizacao.
UPDATE users u
SET email = LOWER(TRIM(u.email))
WHERE u.deleted_at IS NULL
  AND u.email <> LOWER(TRIM(u.email))
  AND NOT EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.deleted_at IS NULL
      AND u2.id <> u.id
      AND LOWER(TRIM(u2.email)) = LOWER(TRIM(u.email))
  );

-- 3) Cria indice unico case-insensitive para proteger contra novos
--    duplicados daqui em diante. Se ainda existirem colisoes
--    irresolvidas (par que so difere na capitalizacao), a criacao
--    do indice falha localmente (violacao de unicidade) — o erro e
--    capturado para NAO abortar o deploy inteiro; o indice
--    simplesmente nao fica ativo ate a colisao ser resolvida
--    manualmente, e esta migration pode ser executada de novo depois.
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
      ON users (LOWER(email))
      WHERE deleted_at IS NULL;
    RAISE NOTICE 'Indice unico idx_users_email_lower criado/ja existente com sucesso.';
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING
      'Nao foi possivel criar o indice unico idx_users_email_lower: existem e-mails colidentes (case-insensitive) ainda nao resolvidos. Resolva as colisoes reportadas acima e rode esta migration novamente para ativar a protecao.';
  END;
END $$;
