# Cutover seguro para o role `fiado_app`

O PostgreSQL do Compose mantém `fiado_user` como role de bootstrap, migrations e manutenção. A API deve usar o role de runtime `fiado_app`, com senha própria em `DB_APP_PASSWORD`. `DB_PASSWORD` continua reservado para `fiado_user`.

O Compose aceita `DB_USER` como override. Para compatibilidade durante a transição, quando `DB_APP_PASSWORD` estiver vazio, a API recebe `DB_PASSWORD` como fallback. Portanto, uma instalação antiga configurada com `DB_USER=fiado_user` continua iniciando sem derrubar a API. O fallback não substitui a configuração correta: com `DB_USER=fiado_app`, preencha obrigatoriamente `DB_APP_PASSWORD` com a senha do role `fiado_app`.

## Procedimento

1. Faça backup e confirme que a API atual está saudável. Não altere ainda `DB_USER` nem a senha de `fiado_user`.
2. Conecte-se ao banco como `fiado_user` e crie o role `fiado_app` caso ainda não exista. Conceda somente os privilégios requeridos pelo runtime da aplicação; não use o role de runtime para migrations/manutenção.
3. Defina a senha do role `fiado_app` com o procedimento seguro de gestão de secrets. Não grave a senha no Git nem em logs.
4. Teste a conexão a partir da rede do Compose usando o host, banco, usuário `fiado_app` e a senha nova. Só prossiga após o teste autenticar com sucesso.
5. Configure `DB_USER=fiado_app` e `DB_APP_PASSWORD` no `.env` da raiz. Mantenha `DB_PASSWORD` inalterado para o container `db` e para manutenção.
6. Valide a interpolação com `docker compose config` sem publicar a saída em logs que possam expor secrets.
7. Recrie apenas a API: `docker compose up -d --no-deps --force-recreate api`.
8. Aguarde e valide o healthcheck da API (`docker compose ps`, logs sem secrets e `GET /api/health`). Confirme também uma operação de leitura/escrita representativa antes de encerrar o cutover.

## Rollback

Se a API não autenticar ou não ficar saudável, restaure `DB_USER=fiado_user` e deixe `DB_APP_PASSWORD` vazio (ou remova-o), de modo que o Compose use o `DB_PASSWORD` antigo. Recrie somente a API com o mesmo comando e confirme o healthcheck. Não altere nem apague dados, roles ou lançamentos durante o rollback; investigue e repita o cutover somente após corrigir a causa.
