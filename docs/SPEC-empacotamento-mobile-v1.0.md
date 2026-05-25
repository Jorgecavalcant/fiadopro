# SPEC: Empacotamento Mobile — Fiado Pro

> **Produto**: Fiado Pro
> **PRD de origem**: `D:\TECH42\PROJETOS\fiado-pro\docs\PRD-empacotamento-mobile-v2.0.md`
> **Versao**: 1.0
> **Data**: 2026-04-13
> **Status**: [x] Rascunho  [ ] Revisada  [ ] Aprovada
> **Autor**: Claude (Analista de Solucoes) | **Revisor**: diretor-tecnologia

---

## Stack e dependencias

| Tecnologia | Versao | Uso |
|---|---|---|
| React | 18 | Frontend SPA |
| Vite | latest | Build tool do frontend |
| Capacitor | latest instalado | Empacotamento nativo Android/iOS |
| Node.js/Express | latest instalado | Backend API |
| TypeScript | latest | Backend e frontend |
| PostgreSQL | 16 | Banco de dados (container fiado-pro-db, porta 5434) |
| Docker Compose | latest | Orquestracao dos containers na VPS |
| Nginx | latest | Servir frontend (porta 10003) |

**Dependencias novas a instalar (Sprint 2):**
```
@capacitor/splash-screen
@capacitor/status-bar
@capacitor/push-notifications
@capacitor/haptics
@capacitor/toast
@capacitor/app
@capacitor/keyboard
@capacitor/network
```

**Servicos externos novos:**
- Firebase Cloud Messaging (FCM) — push notifications Android
- APNs (Apple Push Notification Service) — push notifications iOS
- Codemagic — CI/CD para build iOS
- Google Play Console — publicacao Android
- Apple App Store Connect — publicacao iOS

---

## Mapa de arquivos do projeto

```
VPS /srv/projetos/clientes/fiado-pro/
  frontend/
    src/
      App.tsx                        <- MODIFICAR (credenciais, credentials: include)
      components/
        settings/                    <- MODIFICAR (botao excluir conta)
    capacitor.config.ts              <- VERIFICAR/MODIFICAR (webDir, remover server.url)
    vite.config.ts                   <- verificar (base: './' ja ajustado)
    package.json                     <- MODIFICAR (instalar plugins Capacitor)
    android/                         <- SYNC apos cada build
  backend/
    src/
      routes/
        auth.ts                      <- MODIFICAR (httpOnly cookies, endpoint refresh)
        users.ts                     <- MODIFICAR (endpoint DELETE /api/users/me)
        notifications.ts             <- CRIAR (registro de token FCM)
      middleware/
        auth.ts                      <- MODIFICAR (ler JWT do cookie, nao do header)
      utils/
        jwt.ts                       <- MODIFICAR (helper para set/clear cookie)
      services/
        email.ts                     <- MODIFICAR (email de confirmacao de exclusao)
        push.ts                      <- CRIAR (service FCM)
      server.ts                      <- MODIFICAR (CORS credentials: true)
    migrations/
      001_add_user_deletion_fields.sql   <- CRIAR
      002_add_device_tokens.sql          <- CRIAR
      003_add_consent_fields.sql         <- CRIAR
  .env                               <- CRIAR (raiz do projeto)
  .env.example                       <- CRIAR
  docker-compose.yml                 <- MODIFICAR (substituir secrets por ${VAR})
  .gitignore                         <- MODIFICAR (adicionar .env)
  docs/                              <- CRIAR pasta
```

---

## Sprint 1 — Seguranca (BLOQUEIA TUDO)

**Descricao**: Corrige as tres vulnerabilidades que impedem o lancamento: JWT em localStorage, secrets no docker-compose, e ausencia de exclusao de conta.
**Entregavel**: App com autenticacao segura (httpOnly cookie), secrets em .env, e botao funcional de exclusao de conta.
**Risco**: [x] Alto
**Pre-requisito**: Nenhum — e o ponto de partida.
**Agente responsavel**: desenvolvedor-backend (Features 1.1, 1.2, 1.3, 1.4 backend) + desenvolvedor-frontend (Features 1.1 e 1.3 frontend)

---

### Feature 1.1 — JWT: migrar de localStorage para httpOnly cookie

**Categoria**: auth

**Descricao**: O token JWT atualmente fica salvo no localStorage do browser como `fiado_pro_jwt`. Isso expoe o token a ataques XSS. A migracao move o token para um cookie httpOnly, que o browser nunca expoe ao JavaScript.

**Context tecnico critico**:
- O Capacitor empacota o frontend como assets locais e faz chamadas de API para `https://www.fiadopro.com.br/api`
- Cookies httpOnly funcionam normalmente nesse cenario desde que `credentials: 'include'` esteja configurado nas chamadas fetch e o CORS do backend permita `credentials: true`
- O cookie deve ter os flags: `httpOnly: true`, `secure: true` (HTTPS em producao), `sameSite: 'None'` (necessario para cross-origin do Capacitor), `path: '/'`

**Steps — Backend:**

1. Abrir `backend/src/utils/jwt.ts`. Criar duas funcoes auxiliares:
   - `setAuthCookie(res: Response, token: string): void` — chama `res.cookie('fiado_token', token, { httpOnly: true, secure: true, sameSite: 'None', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })`
   - `clearAuthCookie(res: Response): void` — chama `res.clearCookie('fiado_token', { httpOnly: true, secure: true, sameSite: 'None', path: '/' })`

2. Abrir `backend/src/routes/auth.ts`. Localizar o endpoint `POST /api/auth/login`:
   - Remover o retorno do token no body (`{ token: ... }`)
   - Chamar `setAuthCookie(res, token)` antes de `res.json()`
   - O response body passa a retornar apenas `{ success: true, user: { id, email, name } }`

3. No mesmo arquivo, localizar o endpoint `POST /api/auth/google`:
   - Aplicar a mesma mudanca: remover token do body, usar `setAuthCookie`

4. Criar endpoint `POST /api/auth/refresh` no arquivo `backend/src/routes/auth.ts`:
   - Le o cookie `fiado_token`
   - Verifica se o token e valido e nao expirou
   - Gera um novo token
   - Chama `setAuthCookie(res, novoToken)`
   - Retorna `{ success: true }`
   - Se o cookie nao existir ou token for invalido: retorna 401

5. Localizar o endpoint de logout (se existir) ou criar `POST /api/auth/logout`:
   - Chama `clearAuthCookie(res)`
   - Retorna `{ success: true }`

6. Abrir `backend/src/middleware/auth.ts`. Modificar a logica de extracao do token:
   - Antes: `const token = req.headers.authorization?.split(' ')[1]`
   - Depois: `const token = req.cookies?.fiado_token`
   - Instalar `cookie-parser` se nao estiver instalado: `npm install cookie-parser @types/cookie-parser`
   - Registrar `app.use(cookieParser())` no `backend/src/server.ts` antes das rotas

7. Abrir `backend/src/server.ts`. Atualizar configuracao do CORS:
   - Adicionar `credentials: true` nas opcoes do cors
   - `origin` deve listar explicitamente as origens permitidas (nao usar `*` com credentials)
   - Origens: `['https://www.fiadopro.com.br', 'https://fiadopro.com.br']`

**Steps — Frontend:**

8. Abrir `frontend/src/App.tsx`. Buscar todas as ocorrencias de:
   - `localStorage.setItem` com `fiado_pro_jwt` — remover
   - `localStorage.getItem` com `fiado_pro_jwt` — remover
   - Qualquer logica que le o token do localStorage para montar header `Authorization: Bearer`

9. Em todas as chamadas `fetch` ou axios do frontend, adicionar `credentials: 'include'`:
   - Exemplo: `fetch('/api/clientes', { credentials: 'include' })`
   - Se existir um arquivo central de configuracao de API (ex: `api.ts` ou similar), ajustar la. Caso contrario, buscar todos os `fetch(` no projeto e adicionar a opcao.

10. Implementar logica de refresh automatico no frontend:
    - Se qualquer chamada de API retornar 401, tentar `POST /api/auth/refresh` automaticamente (uma vez)
    - Se o refresh tambem retornar 401: redirecionar para tela de login

**Criterios de aceite:**
- [ ] Login com email/senha retorna cookie `fiado_token` via Set-Cookie header (visivel no DevTools > Network)
- [ ] Login com Google retorna cookie `fiado_token` via Set-Cookie header
- [ ] `localStorage` nao contem mais nenhum JWT apos login
- [ ] Rotas protegidas do backend retornam 200 com o cookie presente
- [ ] Rotas protegidas do backend retornam 401 sem o cookie
- [ ] Logout limpa o cookie (DevTools > Application > Cookies: vazio)
- [ ] Endpoint `POST /api/auth/refresh` renova o cookie corretamente
- [ ] App funciona normalmente apos a migracao: login, listar clientes, registrar fiado

**Edge cases:**
- E se o usuario tiver o app aberto no momento do deploy (token antigo no localStorage): ao fazer a proxima chamada de API, recebera 401 (cookie nao existe), o refresh falhara, e o usuario sera redirecionado para login — comportamento esperado
- E se o cookie expirar enquanto o usuario esta usando o app: a chamada de API retorna 401, o frontend tenta refresh automatico, se bem-sucedido o usuario nao percebe nada, se falhar e redirecionado para login
- E se o `sameSite: 'None'` causar problemas em desenvolvimento local (HTTP): em ambiente de desenvolvimento usar `secure: false` e `sameSite: 'Lax'` — controlar via variavel de ambiente `NODE_ENV`
- E se o `cookie-parser` nao estiver instalado: o `req.cookies` sera `undefined` e todas as rotas protegidas retornarao 401 — verificar instalacao antes do deploy
- E se o CORS nao tiver `credentials: true`: o browser bloqueara o cookie e todas as chamadas falharam com erro de CORS — testar no browser antes de testar no Capacitor

---

### Feature 1.2 — Secrets: mover docker-compose.yml para .env

**Categoria**: infra

**Descricao**: As credenciais (senhas, chaves de API) estao atualmente escritas diretamente no `docker-compose.yml`. Se esse arquivo for enviado para um repositorio ou visto por alguem sem autorizacao, todas as credenciais estao expostas. A correcao move os valores sensiveis para um arquivo `.env` que nunca entra no repositorio.

**Steps:**

1. Na VPS, abrir `/srv/projetos/clientes/fiado-pro/docker-compose.yml` e identificar todos os valores sensiveis hardcoded. As variaveis esperadas (baseado no STATE.md e PRD):
   - `DB_PASSWORD` — senha do PostgreSQL
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `JWT_SECRET`
   - `RESEND_API_KEY`
   - Qualquer outro valor que nao deva ser publico

2. Criar o arquivo `/srv/projetos/clientes/fiado-pro/.env` na raiz do projeto (nao dentro de frontend/ nem backend/) com o conteudo:
   ```
   DB_PASSWORD=<valor_atual>
   GOOGLE_CLIENT_ID=<valor_atual>
   GOOGLE_CLIENT_SECRET=<valor_atual>
   JWT_SECRET=<valor_atual>
   RESEND_API_KEY=<valor_atual>
   ```
   Preencher com os valores que estavam no docker-compose.yml.

3. No `docker-compose.yml`, substituir cada valor hardcoded pela referencia `${VARIAVEL}`:
   - Exemplo: `POSTGRES_PASSWORD: senhaSecreta123` → `POSTGRES_PASSWORD: ${DB_PASSWORD}`
   - O Docker Compose le automaticamente o arquivo `.env` na mesma pasta

4. Verificar se ja existe um `.gitignore` na raiz do projeto. Se nao, criar. Adicionar a linha:
   ```
   .env
   ```

5. Criar o arquivo `/srv/projetos/clientes/fiado-pro/.env.example` com as chaves mas sem os valores:
   ```
   DB_PASSWORD=
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   JWT_SECRET=
   RESEND_API_KEY=
   ```

6. Testar subindo os containers:
   ```bash
   cd /srv/projetos/clientes/fiado-pro
   docker compose down
   docker compose up -d
   docker compose ps
   ```
   Todos os containers devem subir como `healthy`.

**Criterios de aceite:**
- [ ] Arquivo `.env` existe na raiz `/srv/projetos/clientes/fiado-pro/`
- [ ] `.env` esta listado no `.gitignore`
- [ ] `.env.example` existe com as chaves (sem valores)
- [ ] `docker-compose.yml` nao contem mais nenhuma senha ou chave de API em texto plano
- [ ] `docker compose up -d` sobe todos os containers sem erros
- [ ] `docker compose ps` mostra todos os containers como `healthy`
- [ ] Login no app continua funcionando apos a mudanca (confirma que os secrets estao sendo lidos corretamente)

**Edge cases:**
- E se o arquivo `.env` nao estiver na raiz correta (um nivel acima de frontend/ e backend/): o Docker Compose nao encontrara as variaveis e os containers subiram com variaveis vazias — testar com `docker compose config` para ver os valores expandidos antes de subir
- E se uma variavel existir no `.env` mas com nome diferente do esperado pelo docker-compose: o container subira com aquela variavel como string vazia — verificar que os nomes batem exatamente
- E se o `.env` for acidentalmente comitado: revogar imediatamente todas as credenciais expostas, gerar novas, atualizar o `.env` na VPS

---

### Feature 1.3 — Exclusao de conta (Apple Guideline 5.1.1(v))

**Categoria**: api_endpoint + database + frontend

**Descricao**: A Apple exige que todo app com criacao de conta permita exclusao de conta de dentro do proprio app. Sem isso, o app e rejeitado. Esta feature implementa o endpoint de exclusao, a migration no banco e o botao na interface.

**Steps — Database:**

1. Criar migration `backend/migrations/001_add_user_deletion_fields.sql`:
   ```sql
   ALTER TABLE users
     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS deleted_reason TEXT DEFAULT NULL;

   CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)
     WHERE deleted_at IS NULL;
   ```
   A exclusao sera **soft delete**: o registro fica no banco mas marcado como deletado. Isso facilita auditoria e evita problemas de FK com outros dados.

2. Executar a migration na VPS:
   ```bash
   docker exec -it fiado-pro-db psql -U postgres -d fiado_pro -f /migrations/001_add_user_deletion_fields.sql
   ```
   Ou via script de migrations do projeto, se existir.

**Steps — Backend:**

3. Abrir `backend/src/routes/users.ts` (ou criar o arquivo se nao existir, registrando a rota no `server.ts`).

4. Criar endpoint `DELETE /api/users/me`:
   - Requer autenticacao (middleware auth.ts aplicado)
   - Body esperado: `{ "password": "senhaAtual" }` — confirmacao de senha obrigatoria
   - Passos internos do endpoint:
     a. Buscar o usuario pelo ID extraido do JWT (cookie)
     b. Verificar a senha enviada contra o hash armazenado — se incorreta, retornar 403
     c. Verificar se o usuario ja foi deletado (deleted_at IS NOT NULL) — se sim, retornar 404
     d. Executar soft delete: `UPDATE users SET deleted_at = NOW(), deleted_reason = $1 WHERE id = $2`
     e. Chamar `email.ts` para enviar email de confirmacao de exclusao ao usuario
     f. Chamar `clearAuthCookie(res)` para deslogar o usuario
     g. Retornar `{ success: true, message: "Conta excluida com sucesso" }`

5. No middleware `auth.ts`, adicionar verificacao de conta deletada:
   - Apos validar o JWT, buscar o usuario no banco
   - Se `deleted_at IS NOT NULL`: retornar 401 com mensagem `"Conta nao encontrada"`
   - Isso impede que um usuario com token ainda valido acesse o sistema apos exclusao

6. Em `backend/src/services/email.ts`, adicionar funcao `sendAccountDeletionConfirmation(email: string, name: string): Promise<void>`:
   - Assunto: "Sua conta no Fiado Pro foi excluida"
   - Corpo: confirmacao de que os dados foram removidos, informacao sobre LGPD Art. 18, contato para duvidas

**Steps — Frontend:**

7. Localizar a tela de Configuracoes/Perfil no frontend. Se nao existir uma tela dedicada, identificar onde adicionar o botao (menu lateral, perfil do usuario, etc.).

8. Adicionar botao "Excluir minha conta" na tela de configuracoes. O botao deve:
   - Ter estilo visual de acao destrutiva (vermelho ou outline vermelho)
   - Estar posicionado no final da pagina, nao em destaque

9. Ao clicar no botao, abrir um modal de confirmacao com:
   - Titulo: "Excluir conta"
   - Texto: "Esta acao e permanente e nao pode ser desfeita. Todos os seus dados (clientes, fiados e pagamentos) serao removidos."
   - Campo de senha: `<input type="password" placeholder="Digite sua senha para confirmar" />`
   - Botao "Cancelar" (fecha o modal)
   - Botao "Excluir minha conta" (vermelho, desabilitado ate a senha ser digitada)

10. Ao confirmar, chamar `DELETE /api/users/me` com `{ password: senhaDigitada }` e `credentials: 'include'`:
    - Sucesso (200): fechar modal, exibir toast "Conta excluida. Ate logo.", redirecionar para tela de login
    - Erro 403 (senha errada): exibir mensagem no modal "Senha incorreta. Tente novamente."
    - Erro 500: exibir "Erro ao excluir conta. Tente novamente mais tarde."

**Criterios de aceite:**
- [ ] Botao "Excluir minha conta" visivel na tela de configuracoes do app
- [ ] Modal de confirmacao abre ao clicar no botao
- [ ] Campo de senha obrigatorio — botao de confirmacao desabilitado sem senha
- [ ] Senha incorreta retorna mensagem de erro no modal (nao redireciona)
- [ ] Senha correta: conta marcada como `deleted_at = NOW()` no banco
- [ ] Cookie de autenticacao limpo apos exclusao
- [ ] Email de confirmacao de exclusao enviado ao usuario
- [ ] Tentativa de login com conta excluida retorna erro claro ("Conta nao encontrada")
- [ ] Tentativa de usar token ainda valido de conta excluida retorna 401

**Edge cases:**
- E se o usuario esquecer a senha no momento de excluir a conta: exibir link "Esqueceu a senha?" no modal, abrindo o fluxo de recuperacao — mas o usuario precisara criar nova senha antes de poder excluir
- E se o email de confirmacao falhar (Resend indisponivel): a exclusao ja foi efetivada no banco — logar o erro, mas nao reverter a exclusao. O usuario foi deslogado corretamente.
- E se o usuario tentar excluir a conta duas vezes (duplo clique): o segundo request chegara com o usuario ja marcado como deletado — retornar 404, ignorar silenciosamente no frontend
- E se houver dados relacionados em outras tabelas (FK constraints): verificar se o soft delete (nao remover o registro) resolve — se nao, mapear todas as FKs e adicionar ON DELETE SET NULL ou ON DELETE CASCADE conforme o caso
- E se o revisor da Apple testar a exclusao de conta: a conta de teste deve ter dados populados e o fluxo completo deve funcionar sem erros

---

### Feature 1.4 — Password hashing: PBKDF2 → Argon2

**Categoria**: seguranca + database

**Descricao**: Migrar de PBKDF2 com SHA-256 (100k iteracoes) para Argon2. Argon2 venceu a Password Hashing Competition (2015) e e superior a PBKDF2 e bcrypt: resiste ataques GPU/ASIC usando memoria como barreira adicional. State-of-the-art recomendado por OWASP. Obrigatorio antes de publicar nas lojas.

**Steps — Backend:**

1. Instalar dependencias de Argon2:
   ```bash
   cd /srv/projetos/clientes/fiado-pro/backend
   npm install argon2
   npm install --save-dev @types/argon2
   ```

2. Adicionar `PASSWORD_PEPPER` ao arquivo `.env`:
   ```
   PASSWORD_PEPPER=<valor_secreto_aleatorio_minimo_32_caracteres>
   ```
   Gerar com: `openssl rand -base64 32`
   ⚠️ CRÍTICO: Este valor é secreto e NÃO é armazenado no banco — apenas em `.env` (nunca commitar).

3. Abrir `backend/src/utils/password.ts` (criar se nao existir). Implementar com **Pepper**:
   ```typescript
   import * as argon2 from 'argon2';

   const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER;
   if (!PASSWORD_PEPPER || PASSWORD_PEPPER.length < 32) {
     throw new Error('PASSWORD_PEPPER nao configurado ou muito curto (minimo 32 caracteres)');
   }

   // Hash uma senha com Argon2 + Pepper
   // Pepper = valor secreto fixo (nao armazenado, apenas em .env)
   export async function hashPassword(plaintext: string): Promise<string> {
     const peppered = plaintext + PASSWORD_PEPPER;
     return argon2.hash(peppered, {
       type: argon2.argon2id,
       memoryCost: 65536,   // 64MB
       timeCost: 3,          // 3 iteracoes
       parallelism: 4,       // 4 threads
     });
   }

   // Verificar senha contra hash Argon2+Pepper OU legado PBKDF2 (sem pepper)
   export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
     try {
       // Tentar Argon2 com Pepper primeiro
       const peppered = plaintext + PASSWORD_PEPPER;
       return await argon2.verify(hash, peppered);
     } catch (err) {
       // Se Argon2 falhar, tentar PBKDF2 legado (migracao para usuarios antigos — nao tinha pepper)
       const pbkdf2 = require('pbkdf2');
       const salt = hash.split(':')[0];
       const iterations = 100000;
       const digest = 'sha256';
       const derivedKey = pbkdf2.pbkdf2Sync(plaintext, salt, iterations, 64, digest);
       const expected = Buffer.from(hash.split(':')[1], 'hex');
       return derivedKey.equals(expected);
     }
   }

   // Migrar hash PBKDF2 para Argon2+Pepper (ao alterar senha ou durante passivacao)
   export async function migrateToArgon2(plaintext: string): Promise<string> {
     return hashPassword(plaintext);
   }
   ```

4. Abrir `backend/src/routes/auth.ts`. Modificar o endpoint `POST /api/auth/register` e `POST /api/auth/login`:
   - **Register**: Ao criar novo usuario, chamar `hashPassword()` (gera Argon2 automaticamente)
   - **Login**: Chamar `verifyPassword()` que detecta automaticamente Argon2 ou PBKDF2 legado
   - Se detectar PBKDF2: apos login bem-sucedido, rehash a senha em background: 
     ```typescript
     const newHash = await migrateToArgon2(plaintext);
     await db.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, userId]);
     ```

5. Para usuarios existentes com PBKDF2, implementar migracao passiva:
   - Ao fazer login com PBKDF2 detectado, rehash para Argon2 automaticamente (transparente)
   - Nenhuma acao do usuario necessaria

6. Adicionar teste unitario para hash + verify + pepper (ver Secao "Cobertura de Testes" do STATE.md):
   ```typescript
   // backend/src/utils/password.test.ts
   test('hashPassword com Argon2 + Pepper', async () => {
     const plaintext = 'senhaForte123!';
     const hash = await hashPassword(plaintext);
     expect(hash).not.toBe(plaintext);
     expect(hash.startsWith('$argon2')).toBe(true);
   });

   test('verifyPassword com Argon2 + Pepper', async () => {
     const plaintext = 'senhaForte123!';
     const hash = await hashPassword(plaintext);
     expect(await verifyPassword(plaintext, hash)).toBe(true);
     expect(await verifyPassword('senhaErrada', hash)).toBe(false);
   });

   test('Pepper nao pode ser descoberto pelo hash', async () => {
     const plaintext = 'senha';
     const hash = await hashPassword(plaintext);
     // O hash nao revela o pepper — apenas plaintext + pepper foi hashado
     expect(hash).not.toContain(process.env.PASSWORD_PEPPER);
   });

   test('verifyPassword com PBKDF2 legado (migracao — sem pepper)', async () => {
     const pbkdf2LegacyHash = '...'; // hash PBKDF2 existente no banco (nao tinha pepper)
     expect(await verifyPassword('senhaCorreta', pbkdf2LegacyHash)).toBe(true);
   });
   ```

**Steps — Database:**

7. Nenhuma alteracao de schema necessaria — coluna `password` continua VARCHAR. Os hashes Argon2+Pepper sao strings iguais aos PBKDF2 anteriores, apenas mais longas.

**Steps — Segurança (Pepper):**

8. ⚠️ **CRÍTICO**: Garantir que `PASSWORD_PEPPER` está:
   - Definido em `.env` (nunca em docker-compose.yml ou código)
   - Listado em `.gitignore` (arquivo `.env` nunca é comitado)
   - Documentado em `.env.example` como vazio (sem o valor real)
   - Rotacionado se exposto: gerar novo pepper, rehash todos os usuarios no login (detecta hash antigo, rehasha com novo pepper)

**Criterios de aceite:**
- [ ] Dependencia `argon2` instalada
- [ ] `PASSWORD_PEPPER` gerado e adicionado ao `.env` (minimo 32 caracteres)
- [ ] `PASSWORD_PEPPER` listado em `.gitignore` e `.env.example` (vazio)
- [ ] `hashPassword()` gera hash Argon2+Pepper valido
- [ ] `verifyPassword()` valida Argon2+Pepper com sucesso
- [ ] `verifyPassword()` detecta e valida PBKDF2 legado sem pepper (migracao)
- [ ] Pepper nao aparece no hash ou em logs (segurança confirmada)
- [ ] Login com usuario novo gera hash Argon2+Pepper
- [ ] Login com usuario existente (PBKDF2) rehasha em background para Argon2+Pepper
- [ ] Todos os 4 testes unitarios passam (Argon2+Pepper hash, Argon2+Pepper verify, Pepper security, PBKDF2 legado)
- [ ] App funciona normalmente apos a migracao: login, clientes, fiados

**Edge cases:**
- E se o usuario alterar senha: novo hash ja e Argon2+Pepper (migracao imediata)
- E se o usuario nunca alterar senha: rehash acontece silenciosamente no proximo login (migracao passiva)
- E se houver erro durante rehash em background: logar erro mas nao quebrar login — o usuario entra normalmente com hash PBKDF2 ainda valido, proxima tentativa rehasha
- E se o usuario estiver com PBKDF2 e tentar fazer reset de senha: novo hash e Argon2+Pepper, reset termina com sucesso
- E se o PASSWORD_PEPPER for exposto: gerar novo pepper no `.env`, criar funcao para rehash com novo pepper ao login (detecta hash antigo, rehasha com novo)
- E se o PASSWORD_PEPPER estiver vazio/indefinido: servidor falha no startup com erro claro (nao permite operacao sem pepper)

---

### Processo de deploy — Sprint 1

Executar na VPS apos cada mudanca no backend:

```bash
cd /srv/projetos/clientes/fiado-pro/frontend
npm run build

cd /srv/projetos/clientes/fiado-pro
docker compose build api
docker compose up -d
docker compose ps
```

Verificar que `fiado-pro-api` e `fiado-pro-db` e `fiado-pro-nginx` estao `healthy`.
Testar no browser: `https://www.fiadopro.com.br` — login, listagem de clientes, lancamento de fiado.

### Criterios de aceite — Sprint 1 completa

- [ ] JWT migrado de `localStorage` para `httpOnly cookie` e testado em producao
- [ ] Secrets removidos do `docker-compose.yml` e funcionando via `.env`
- [ ] `.env` confirmado no `.gitignore`
- [ ] `.env.example` criado
- [ ] **NOVO:** Password hashing migrado para Argon2 (biblioteca instalada, testes passando, migracao de usuarios existentes funcionando)
- [ ] Endpoint `DELETE /api/users/me` implementado com confirmacao de senha
- [ ] Botao "Excluir minha conta" funcional na tela de configuracoes
- [ ] Email de confirmacao de exclusao enviado ao usuario
- [ ] App funciona normalmente apos todas as mudancas (login, clientes, fiados, novo password hashing)

---

## Sprint 2 — Features Nativas Capacitor

**Descricao**: Instalar e configurar os 8 plugins Capacitor obrigatorios para que o app tenha experiencia nativa real (nao apenas um site dentro de um frame).
**Entregavel**: App com splash screen, status bar integrada, push notifications, haptic feedback, toasts nativos, deep links, controle de teclado e indicador de offline.
**Risco**: [x] Medio
**Pre-requisito**: Sprint 1 concluida e validada.
**Agente responsavel**: desenvolvedor-frontend (Features 2.1–2.5, 2.7, 2.8) + desenvolvedor-backend (Feature 2.3 backend)

---

### Feature 2.1 — Splash Screen nativa

**Categoria**: build + frontend

**Descricao**: Elimina o "flash branco" que aparece quando o app carrega. O Capacitor exibe uma splash screen nativa enquanto o WebView inicializa.

**Steps:**

1. Na VPS, dentro de `frontend/`:
   ```bash
   npm install @capacitor/splash-screen
   ```

2. Abrir `frontend/capacitor.config.ts`. Adicionar configuracao de splash:
   ```typescript
   plugins: {
     SplashScreen: {
       launchShowDuration: 2000,
       launchAutoHide: true,
       launchFadeOutDuration: 500,
       backgroundColor: "#553C9A",
       androidSplashResourceName: "splash",
       showSpinner: false,
     }
   }
   ```

3. Criar os assets de splash screen:
   - Android: `1080x1920px` PNG, fundo roxo `#553C9A`, logo Fiado Pro centralizado
   - Copiar para: `frontend/android/app/src/main/res/drawable/splash.png`
   - Tambem criar versoes para diferentes densidades se necessario (ldpi, mdpi, hdpi, xhdpi, xxhdpi)

4. No `frontend/src/main.tsx` ou no `App.tsx`, importar e chamar `SplashScreen.hide()` quando o app terminar de carregar:
   ```typescript
   import { SplashScreen } from '@capacitor/splash-screen';
   // Dentro do useEffect inicial, apos dados carregados:
   await SplashScreen.hide();
   ```

5. Executar `npx cap sync android` dentro de `frontend/`.

**Criterios de aceite:**
- [ ] Splash screen roxo (#553C9A) aparece ao abrir o app — nenhum flash branco
- [ ] Splash screen desaparece suavemente (fade) quando o app carrega
- [ ] `npx cap sync android` executa sem erros

**Edge cases:**
- E se o `SplashScreen.hide()` nunca for chamado (erro no JS antes de chegar nesse ponto): a splash screen ficara visivel para sempre — garantir que o hide esta num bloco try/finally ou com timeout maximo de 5 segundos como fallback (`launchAutoHide: true` ja cobre isso)
- E se o asset `splash.png` nao existir no caminho correto: o app abrira sem splash screen mas sem quebrar — verificar o caminho antes do build

---

### Feature 2.2 — Status Bar nativa

**Categoria**: frontend

**Descricao**: Integra a cor da barra de status do celular (onde ficam hora, bateria, sinal) com o tema roxo do app. Sem isso, a status bar fica branca ou preta sem relacao com o design do app.

**Steps:**

1. ```bash
   npm install @capacitor/status-bar
   ```

2. No `frontend/capacitor.config.ts`, adicionar:
   ```typescript
   StatusBar: {
     style: StatusBarStyle.Dark,
     backgroundColor: "#553C9A",
   }
   ```

3. No `App.tsx`, importar e configurar no `useEffect` inicial:
   ```typescript
   import { StatusBar, Style } from '@capacitor/status-bar';
   // Dentro do useEffect:
   await StatusBar.setStyle({ style: Style.Dark });
   await StatusBar.setBackgroundColor({ color: '#553C9A' });
   ```

4. `npx cap sync android`

**Criterios de aceite:**
- [ ] Status bar exibe fundo roxo `#553C9A` no Android
- [ ] Icones da status bar (hora, bateria) aparecem em branco (contraste adequado)

**Edge cases:**
- E se o plugin nao estiver disponivel em Web (quando rodando no browser para teste): as chamadas devem ser envolvidas em `if (Capacitor.isNativePlatform())` para evitar erros no browser
- E se a cor de fundo for diferente em telas especificas do app: pode chamar `StatusBar.setBackgroundColor` nas telas especificas conforme necessario

---

### Feature 2.3 — Push Notifications

**Categoria**: integracao + api_endpoint + database

**Descricao**: Notifica o comerciante quando um fiado vence. Esta e a feature nativa mais complexa e de maior valor para o usuario.

**Arquitetura**: Frontend pede permissao e registra token FCM → envia token para backend → backend armazena token → job periodico no backend verifica fiados vencidos → backend envia push via FCM → usuario recebe notificacao mesmo com app fechado.

**Steps — Firebase:**

1. Jorge cria um projeto no Firebase Console (`console.firebase.google.com`):
   - Nome: "Fiado Pro"
   - Adicionar app Android com package name `br.com.fiadopro.app`
   - Baixar `google-services.json`
   - Copiar `google-services.json` para `frontend/android/app/`
   - Copiar a Server Key (FCM Legacy) ou configurar Firebase Admin SDK

2. Instalar Firebase Admin no backend:
   ```bash
   cd /srv/projetos/clientes/fiado-pro/backend
   npm install firebase-admin
   ```

3. Adicionar ao `.env` da raiz:
   ```
   FIREBASE_PROJECT_ID=
   FIREBASE_CLIENT_EMAIL=
   FIREBASE_PRIVATE_KEY=
   ```
   Valores vem do arquivo de credenciais do Firebase Admin SDK (JSON).

**Steps — Database:**

4. Criar migration `backend/migrations/002_add_device_tokens.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS device_tokens (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token TEXT NOT NULL,
     platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE(user_id, token)
   );

   CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
   ```

5. Executar a migration:
   ```bash
   docker exec -it fiado-pro-db psql -U postgres -d fiado_pro -f /migrations/002_add_device_tokens.sql
   ```

**Steps — Backend:**

6. Criar `backend/src/services/push.ts`:
   - Inicializar Firebase Admin SDK com as credenciais do `.env`
   - Funcao `sendPushNotification(token: string, title: string, body: string): Promise<void>`
   - Funcao `sendPushToUser(userId: string, title: string, body: string): Promise<void>` — busca todos os tokens do usuario e envia para cada um

7. Criar `backend/src/routes/notifications.ts`:
   - `POST /api/notifications/register` — salva o token FCM do dispositivo
     - Body: `{ token: string, platform: 'android' | 'ios' }`
     - Requer autenticacao
     - Faz upsert na tabela `device_tokens` (INSERT ON CONFLICT DO NOTHING)
   - Registrar a rota no `server.ts`

8. No backend, criar um job que roda periodicamente (pode ser um `setInterval` no `server.ts` ou um cron com `node-cron`):
   - Instalar se necessario: `npm install node-cron @types/node-cron`
   - Rodar diariamente as 8h da manha (horario de Brasilia)
   - Query: buscar todos os fiados com `data_vencimento = hoje` e `status = 'pendente'`
   - Para cada fiado, chamar `sendPushToUser(userId, "Fiado vencendo hoje", "O cliente [nome] tem R$ [valor] vencendo hoje.")`

**Steps — Frontend:**

9. ```bash
   npm install @capacitor/push-notifications
   ```

10. No `App.tsx`, criar funcao `setupPushNotifications()` chamada no `useEffect` inicial (apenas se `Capacitor.isNativePlatform()`):
    ```typescript
    import { PushNotifications } from '@capacitor/push-notifications';

    const setupPushNotifications = async () => {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        await fetch('/api/notifications/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.value, platform: 'android' }),
        });
      });
    };
    ```

11. `npx cap sync android`

**Criterios de aceite:**
- [ ] App pede permissao de notificacao no primeiro login (Android)
- [ ] Token FCM registrado na tabela `device_tokens` apos permissao concedida
- [ ] Endpoint `POST /api/notifications/register` retorna 200
- [ ] Notificacao de teste enviada manualmente via Firebase Console chega no dispositivo
- [ ] Notificacao de fiado vencido disparada pelo job periodico chega no dispositivo (testar com fiado criado para hoje)
- [ ] App recebe notificacao com app em foreground e em background

**Edge cases:**
- E se o usuario negar a permissao de notificacao: nao registrar token, nao mostrar erro, continuar funcionando — mostrar um aviso sutil "Ative as notificacoes para ser alertado sobre fiados vencidos" uma vez
- E se o token FCM mudar (apos reinstalacao do app): a nova requisicao de registro fara upsert com o novo token — garantir que tokens antigos do mesmo dispositivo sejam substituidos (adicionar campo `device_id` unico ou usar `UNIQUE(user_id, token)`)
- E se o Firebase Admin SDK nao conseguir enviar (token invalido/expirado): capturar o erro `messaging/registration-token-not-registered`, remover o token da tabela `device_tokens`
- E se o job periodico falhar silenciosamente: adicionar log de erro e considerar alertas de monitoramento

---

### Feature 2.4 — Haptic Feedback

**Categoria**: frontend

**Descricao**: Vibracoes sutis confirmam acoes importantes para o usuario, tornando o app mais responsivo e "nativo".

**Steps:**

1. ```bash
   npm install @capacitor/haptics
   ```

2. Importar e chamar `Haptics.impact()` nos seguintes momentos (envolver em `if (Capacitor.isNativePlatform())`):
   - Ao registrar novo fiado com sucesso: `Haptics.impact({ style: ImpactStyle.Medium })`
   - Ao confirmar pagamento com sucesso: `Haptics.impact({ style: ImpactStyle.Light })`
   - Ao excluir cliente: `Haptics.impact({ style: ImpactStyle.Heavy })`

3. `npx cap sync android`

**Criterios de aceite:**
- [ ] Vibracao perceptivel ao registrar novo fiado
- [ ] Vibracao leve ao confirmar pagamento
- [ ] Vibracao forte ao excluir cliente
- [ ] Nenhum erro no browser (chamadas protegidas por `isNativePlatform()`)

**Edge cases:**
- E se o dispositivo estiver no modo silencioso: o haptic feedback funciona normalmente — e vibracao, nao som
- E se o dispositivo nao suportar haptic feedback: o Capacitor ignora silenciosamente a chamada

---

### Feature 2.5 — Toast nativos

**Categoria**: frontend

**Descricao**: Substitui os `alert()` e notificacoes do browser por toasts nativos do sistema operacional.

**Steps:**

1. ```bash
   npm install @capacitor/toast
   ```

2. Criar uma funcao helper `showToast(message: string, duration: 'short' | 'long' = 'short')` em um arquivo de utilitarios (ex: `frontend/src/utils/toast.ts`):
   ```typescript
   import { Toast } from '@capacitor/toast';
   import { Capacitor } from '@capacitor/core';

   export const showToast = async (message: string, duration: 'short' | 'long' = 'short') => {
     if (Capacitor.isNativePlatform()) {
       await Toast.show({ text: message, duration });
     } else {
       // Fallback para o browser: usar o sistema de notificacao existente
       console.log('[Toast]', message);
     }
   };
   ```

3. Substituir os seguintes pontos no frontend pela funcao `showToast`:
   - Sucesso ao registrar fiado: "Fiado registrado com sucesso!"
   - Sucesso ao confirmar pagamento: "Pagamento confirmado!"
   - Sucesso ao adicionar cliente: "Cliente adicionado!"
   - Erros de conexao: "Sem conexao. Tente novamente."

**Criterios de aceite:**
- [ ] Toast nativo aparece apos registrar fiado
- [ ] Toast nativo aparece apos confirmar pagamento
- [ ] Nenhum `alert()` do browser em operacoes de sucesso

**Edge cases:**
- E se a mensagem for muito longa para um toast: usar `duration: 'long'` automaticamente para mensagens acima de 50 caracteres

---

### Feature 2.6 — Deep Links

**Categoria**: infra + frontend + backend

**Descricao**: Permite que links `fiadopro://` abram o app diretamente. Util para campanhas de marketing e compartilhamentos.

**Steps — Android App Links:**

1. ```bash
   npm install @capacitor/app
   ```

2. No `frontend/capacitor.config.ts`, verificar que o App ID esta como `br.com.fiadopro.app`.

3. No backend, criar endpoint `GET /.well-known/assetlinks.json`:
   - Retorna o JSON de verificacao do Android App Links
   - O valor de `sha256_cert_fingerprints` sera preenchido apos gerar o keystore (Sprint 4)
   - Por ora, criar o endpoint com estrutura correta e fingerprint placeholder

4. No backend, criar endpoint `GET /.well-known/apple-app-site-association`:
   - Retorna o JSON de verificacao do iOS Universal Links
   - O valor do `appID` sera `TEAMID.br.com.fiadopro.app` — preencher apos obter o Team ID da Apple Developer

5. No frontend `App.tsx`, adicionar listener para deep links:
   ```typescript
   import { App as CapacitorApp } from '@capacitor/app';
   CapacitorApp.addListener('appUrlOpen', (data) => {
     const url = new URL(data.url);
     // Navegar para a rota correspondente dentro do app
     // Ex: fiadopro://clientes -> navegar para /clientes
   });
   ```

6. `npx cap sync android`

**Criterios de aceite:**
- [ ] Endpoint `GET /.well-known/assetlinks.json` acessivel em `https://www.fiadopro.com.br/.well-known/assetlinks.json`
- [ ] Endpoint `GET /.well-known/apple-app-site-association` acessivel
- [ ] Listener de deep link registrado no app (verificar nos logs)

**Edge cases:**
- E se o deep link apontar para uma rota que nao existe no app: redirecionar para a tela inicial
- E se o app nao estiver instalado quando o link for clicado: o sistema operacional redireciona para a Play Store / App Store

---

### Feature 2.7 — Keyboard

**Categoria**: frontend

**Descricao**: Controla o comportamento do teclado virtual para evitar bugs de layout (conteudo escondido atras do teclado em formularios).

**Steps:**

1. ```bash
   npm install @capacitor/keyboard
   ```

2. No `frontend/capacitor.config.ts`, adicionar:
   ```typescript
   Keyboard: {
     resize: KeyboardResize.Body,
     style: KeyboardStyle.Default,
     resizeOnFullScreen: true,
   }
   ```

3. `npx cap sync android`

**Criterios de aceite:**
- [ ] Ao abrir teclado em formulario de novo fiado, o campo de input fica visivel (nao escondido atras do teclado)
- [ ] Ao fechar o teclado, o layout volta ao normal sem artefatos visuais

**Edge cases:**
- E se o modo de resize causar pulos de layout: testar `KeyboardResize.Native` como alternativa

---

### Feature 2.8 — Network (modo offline)

**Categoria**: frontend

**Descricao**: Detecta quando o dispositivo fica sem internet e exibe um banner informativo. Bloqueia operacoes de escrita quando offline para evitar perda de dados.

**Steps:**

1. ```bash
   npm install @capacitor/network
   ```

2. No `App.tsx`, adicionar monitoramento de rede:
   ```typescript
   import { Network } from '@capacitor/network';

   const [isOnline, setIsOnline] = useState(true);

   useEffect(() => {
     Network.getStatus().then(status => setIsOnline(status.connected));
     Network.addListener('networkStatusChange', status => {
       setIsOnline(status.connected);
     });
   }, []);
   ```

3. Criar componente `OfflineBanner`:
   - Exibido no topo do app quando `isOnline === false`
   - Texto: "Sem conexao com a internet"
   - Cor de fundo: amarelo `#F6AD55`, texto escuro
   - Desaparece automaticamente quando a conexao volta

4. Nos botoes de salvar fiado, confirmar pagamento e adicionar cliente: desabilitar o botao quando `isOnline === false` e exibir tooltip "Sem conexao — aguarde a reconexao".

**Criterios de aceite:**
- [ ] Banner "Sem conexao" aparece imediatamente ao desativar o Wi-Fi/dados no dispositivo
- [ ] Banner desaparece quando a conexao e restabelecida
- [ ] Botao de registrar fiado desabilitado quando offline
- [ ] Nenhum erro de console ao alternar entre online/offline

**Edge cases:**
- E se a rede for instavel (oscila rapidamente): debounce de 500ms antes de alterar o estado, para evitar flicker do banner
- E se o `Network.getStatus()` retornar que esta online mas as chamadas de API falharem: tratar o erro 503/timeout das chamadas normalmente — o Network plugin e uma indicacao, nao garantia

---

### Criterios de aceite — Sprint 2 completa

- [ ] Todos os 8 plugins Capacitor instalados (`package.json` atualizado)
- [ ] `npx cap sync android` executado sem erros apos todas as instalacoes
- [ ] Push Notifications enviando notificacao de teste para dispositivo Android real
- [ ] Splash Screen exibida ao abrir o app (sem flash branco)
- [ ] Haptic Feedback disparado ao registrar fiado (testado em dispositivo real)
- [ ] Banner "Sem conexao" exibido ao desativar dados moveis
- [ ] Toasts nativos substituindo alertas do browser
- [ ] Build Android compila sem erros apos todas as mudancas

---

## Sprint 3 — Compliance e Legal

**Descricao**: Cria as paginas de Politica de Privacidade e Termos de Uso, registra o consentimento no cadastro, e prepara a conta de teste para o revisor da Apple.
**Entregavel**: URLs de privacidade e termos publicadas, consentimento registrado no banco, conta de teste com dados ficticios prontos.
**Risco**: [x] Medio
**Pre-requisito**: Sprint 1 concluida.
**Agente responsavel**: desenvolvedor-frontend (Features 3.1, 3.2, 3.3 frontend) + desenvolvedor-backend (Feature 3.3 backend)

---

### Feature 3.1 — Pagina de Politica de Privacidade

**Categoria**: frontend

**Descricao**: Pagina web publica obrigatoria para Play Store e App Store. Deve estar acessivel sem login.

**Steps:**

1. Criar componente `frontend/src/pages/PrivacyPolicy.tsx`:
   - Pagina estatica, sem autenticacao
   - URL: `/privacidade`
   - Conteudo obrigatorio:
     - Dados coletados: nome e email do lojista; nome, telefone e historico de fiado dos clientes do lojista
     - Finalidade: gerenciar credito informal entre comerciante e seus clientes
     - Base legal (LGPD Art. 7, I): consentimento do titular
     - Retencao de dados: enquanto a conta estiver ativa; excluidos mediante solicitacao (Art. 18)
     - Compartilhamento: dados nao sao vendidos ou compartilhados com terceiros; exceto provedores de infraestrutura (Hetzner VPS, Resend email)
     - Direitos do titular (Art. 18): acesso, correcao, exclusao, portabilidade — exerciveis via app ou email
     - Contato do DPO/responsavel: email de contato da Tech 42
     - Data de vigencia: 13/04/2026

2. Registrar a rota no `App.tsx` ou no roteador do projeto:
   ```typescript
   <Route path="/privacidade" element={<PrivacyPolicy />} />
   ```

3. Verificar que a rota funciona sem autenticacao (nao pode estar protegida pelo middleware de auth do frontend).

4. Apos deploy, confirmar que `https://www.fiadopro.com.br/privacidade` retorna HTTP 200.

**Criterios de aceite:**
- [ ] `https://www.fiadopro.com.br/privacidade` acessivel sem login
- [ ] Pagina contem: dados coletados, finalidade, direitos LGPD, contato
- [ ] Pagina legivel em mobile (sem scroll horizontal)
- [ ] Data de vigencia visivel

**Edge cases:**
- E se o usuario acessar `/privacidade` logado: deve exibir a pagina normalmente (nao redirecionar)
- E se o Nginx nao estiver configurado para servir rotas do React Router (retorna 404 em refresh direto): adicionar `try_files $uri $uri/ /index.html` na configuracao do Nginx

---

### Feature 3.2 — Pagina de Termos de Uso

**Categoria**: frontend

**Descricao**: Pagina web publica obrigatoria para as stores.

**Steps:**

1. Criar componente `frontend/src/pages/TermsOfService.tsx`:
   - URL: `/termos`
   - Conteudo obrigatorio:
     - Descricao do servico: app de gerenciamento de credito informal para pequenos comerciantes
     - Licenca de uso: licenca limitada, nao exclusiva, nao transferivel
     - Responsabilidades do usuario: uso legal, nao usar para fins fraudulentos
     - Limitacao de responsabilidade: Tech 42 fornece a plataforma; o comerciante e responsavel pelas decisoes de credito
     - Cancelamento: usuario pode cancelar e excluir conta a qualquer momento
     - Alteracoes nos termos: JC pode alterar os termos com aviso previo de 30 dias
     - Lei aplicavel: Brasil, foro da cidade de [cidade sede da JC]

2. Registrar a rota:
   ```typescript
   <Route path="/termos" element={<TermsOfService />} />
   ```

3. Verificar acessibilidade sem autenticacao.

**Criterios de aceite:**
- [ ] `https://www.fiadopro.com.br/termos` acessivel sem login
- [ ] Pagina contem: descricao do servico, responsabilidades, cancelamento
- [ ] Pagina legivel em mobile

**Edge cases:**
- Mesmos edge cases da Feature 3.1 (Nginx + React Router)

---

### Feature 3.3 — Consentimento no cadastro

**Categoria**: database + frontend + api_endpoint

**Descricao**: LGPD Art. 8 exige que o consentimento seja registrado com evidencias. Esta feature adiciona o checkbox obrigatorio no cadastro e salva o timestamp + IP no banco.

**Steps — Database:**

1. Criar migration `backend/migrations/003_add_consent_fields.sql`:
   ```sql
   ALTER TABLE users
     ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS consent_ip VARCHAR(45) DEFAULT NULL;
   ```

2. Executar a migration.

**Steps — Backend:**

3. No endpoint `POST /api/auth/register` (em `backend/src/routes/auth.ts`):
   - Adicionar ao body esperado: `consent: boolean` (obrigatorio)
   - Validar: se `consent !== true`, retornar 400 com `"Voce precisa aceitar a Politica de Privacidade e os Termos de Uso para se cadastrar"`
   - Ao criar o usuario, salvar: `consent_at = NOW()`, `consent_ip = req.ip` (ou `req.headers['x-forwarded-for']` se estiver atras de proxy)

**Steps — Frontend:**

4. Na tela de cadastro (`frontend/src/`), adicionar antes do botao de cadastrar:
   ```html
   <input type="checkbox" id="consent" required />
   <label for="consent">
     Li e aceito a <a href="/privacidade">Politica de Privacidade</a>
     e os <a href="/termos">Termos de Uso</a>
   </label>
   ```

5. O botao de cadastrar deve estar desabilitado ate o checkbox ser marcado.

6. Incluir `consent: true` no body da requisicao de cadastro quando o checkbox estiver marcado.

**Criterios de aceite:**
- [ ] Checkbox obrigatorio visivel na tela de cadastro
- [ ] Botao de cadastrar desabilitado sem o checkbox marcado
- [ ] Cadastro bem-sucedido salva `consent_at` e `consent_ip` no banco (verificar com query no banco)
- [ ] Tentativa de cadastro sem `consent: true` retorna 400
- [ ] Links "Politica de Privacidade" e "Termos de Uso" abrem as paginas corretas

**Edge cases:**
- E se o usuario estiver atras de um proxy e `req.ip` retornar o IP do proxy: usar `req.headers['x-forwarded-for']` como primeira opcao
- E se o frontend enviar `consent: false` (bypass do checkbox via API direta): a validacao no backend captura e retorna 400

---

### Feature 3.4 — Conta de teste para revisor Apple

**Categoria**: infra (manual)

**Descricao**: O revisor da Apple precisa de uma conta funcional com dados populados para testar o app. Sem isso, o revisor nao consegue avaliar as funcionalidades e o app pode ser rejeitado.

**Steps:**

1. Criar uma conta no app com as seguintes credenciais ficticias:
   - Email: `revisor.apple@fiadopro.com.br` (ou similar)
   - Senha: senha forte e anotada

2. Popular a conta com dados ficticios:
   - 5 clientes com nomes ficticios (ex: "Ana Costa", "Rui Pereira", "Lucia Ferreira")
   - 10 fiados em diferentes estados (pendente, pago, vencido)
   - 3 pagamentos registrados

3. Verificar que o fluxo completo funciona com essa conta:
   - Login
   - Visualizar lista de clientes
   - Visualizar fiados de um cliente
   - Registrar novo fiado
   - Confirmar pagamento
   - Excluir conta (testar e recriar — ou ter uma conta substituta)

4. Documentar as credenciais no campo "Review Notes" do App Store Connect (Sprint 4).

**Criterios de aceite:**
- [ ] Conta de teste criada e acessivel
- [ ] Pelo menos 5 clientes e 10 fiados populados
- [ ] Todos os fluxos principais funcionam com a conta de teste
- [ ] Credenciais documentadas para uso no Sprint 4

---

### Criterios de aceite — Sprint 3 completa

- [ ] `https://www.fiadopro.com.br/privacidade` publicada e acessivel
- [ ] `https://www.fiadopro.com.br/termos` publicada e acessivel
- [ ] Checkbox de consentimento no cadastro com timestamp e IP gravados no banco
- [ ] Conta de teste Apple com dados ficticios populados e funcional

---

## Sprint 4 — Build e Publicacao

**Descricao**: Gerar os builds assinados para Android e iOS, publicar nas lojas.
**Entregavel**: App disponivel para download na Play Store e App Store.
**Risco**: [x] Alto
**Pre-requisito**: Sprints 1, 2 e 3 concluidas. Jorge com contas Play Console e Apple Developer criadas.
**Agente responsavel**: Esta sprint e majoritariamente executada por Jorge com orientacao do time tecnico.

---

### Feature 4.1 — Verificar configuracao Capacitor para assets locais

**Categoria**: build

**Descricao**: Verificacao critica antes de qualquer build. O app DEVE carregar os arquivos locais do pacote, nao uma URL remota — caso contrario e rejeitado pelas stores.

**Steps:**

1. Abrir `frontend/capacitor.config.ts`. Verificar:
   - `webDir: 'dist'` — deve apontar para a pasta do build local
   - Nao deve existir `server: { url: '...' }` — se existir, remover completamente
   - Se existir `server.hostname` ou `server.androidScheme`, manter apenas se for configuracao local (nao URL de producao)

2. Verificar que o `API_URL` no frontend aponta para a URL de producao como variavel de ambiente, nao hardcoded:
   - Abrir `frontend/src/App.tsx` (linha ~75 conforme contexto)
   - Se `API_URL` estiver hardcoded: mover para variavel de ambiente `VITE_API_URL`
   - Criar `frontend/.env.production` com `VITE_API_URL=https://www.fiadopro.com.br/api`

3. Executar build completo e sync:
   ```bash
   cd /srv/projetos/clientes/fiado-pro/frontend
   npm run build
   npx cap sync android
   ```

4. Verificar que a pasta `frontend/android/app/src/main/assets/public/` foi gerada com os arquivos do build.

**Criterios de aceite:**
- [ ] `capacitor.config.ts` sem `server.url` remoto
- [ ] `webDir` apontando para `dist`
- [ ] `npm run build` executa sem erros
- [ ] `npx cap sync android` executa sem erros
- [ ] Pasta `android/app/src/main/assets/public/` contem `index.html` e arquivos JS/CSS

**Edge cases:**
- E se o `dist/` na raiz (volume nginx) for confundido com o `dist/` do Capacitor: sao pastas diferentes — o nginx serve `/srv/projetos/clientes/fiado-pro/dist/` e o Capacitor usa `frontend/dist/`. Confirmar que o `webDir` aponta para `frontend/dist/` e nao para a raiz
- E se o build falhar com erro de TypeScript: corrigir os erros antes de continuar — nao usar `--skipTypeCheck` para o build de producao

---

### Feature 4.2 — Assets de loja

**Categoria**: infra (manual — responsabilidade de Jorge)

**Descricao**: Todos os assets visuais necessarios para publicacao nas lojas.

**Steps:**

1. **Icone do app** (Jorge cria via DALL-E ou Midjourney):
   - Prompt sugerido: "Minimalist app icon for a small business credit tracking app called 'Fiado Pro'. Purple background (#553C9A), white clean icon depicting a handshake or a small shop ledger. Flat design, no gradients, no text, suitable for app store. 1024x1024px."
   - Formato: PNG, 1024x1024px, fundo opaco (sem transparencia, sem arredondamento)

2. **Splash Screen** (baseada no icone):
   - Android: 1080x1920px
   - iOS: 1290x2796px (iPhone 15 Pro Max)

3. **Screenshots** (Jorge captura do emulador ou dispositivo real):
   - Android: minimo 2 screenshots, 1080x1920px
   - iOS: minimo 3 screenshots, 1290x2796px
   - Sugestao de telas a capturar: tela inicial com lista de clientes, tela de detalhes de cliente com fiados, tela de adicionar fiado, tela de dashboard/resumo

4. **Feature Graphic** (Play Store):
   - 1024x500px
   - Fundo roxo com logo e tagline: "Controle o fiado do seu negocio"

**Criterios de aceite:**
- [ ] Icone 1024x1024px criado com fundo opaco
- [ ] Screenshots Android e iOS nos tamanhos corretos
- [ ] Feature Graphic 1024x500px criado

---

### Feature 4.3 — Build Android (AAB)

**Categoria**: build (execucao local por Jorge)

**Descricao**: Gerar o Android App Bundle assinado para publicacao na Play Store.

**Steps:**

1. Jorge baixa a pasta `frontend/android/` da VPS para sua maquina Windows:
   ```bash
   # No terminal do Windows (PowerShell ou WSL):
   scp -r jorge@46.224.55.18:/srv/projetos/clientes/fiado-pro/frontend/android D:\TECH42\PROJETOS\fiado-pro\android
   ```

2. Jorge instala o Android Studio (se ainda nao instalado): `developer.android.com/studio`

3. Jorge abre o Android Studio e importa o projeto: `File > Open > D:\TECH42\PROJETOS\fiado-pro\android`

4. Aguardar a sincronizacao do Gradle completar.

5. Gerar keystore de assinatura (apenas na primeira vez):
   ```bash
   keytool -genkey -v -keystore fiado-pro-release.jks -alias fiado-pro -keyalg RSA -keysize 2048 -validity 10000
   ```
   Guardar o arquivo `.jks` e a senha em local seguro — NUNCA enviar para o repositorio.

6. No Android Studio: `Build > Generate Signed Bundle / APK > Android App Bundle`
   - Selecionar o keystore gerado
   - Build type: Release
   - Clicar em Finish

7. O AAB sera gerado em `android/app/release/app-release.aab`.

8. Testar o AAB em dispositivo real via Android Studio antes de submeter.

**Criterios de aceite:**
- [ ] AAB gerado sem erros de build
- [ ] App instalado e funcional em dispositivo Android real
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no dispositivo real
- [ ] Splash screen aparece ao abrir
- [ ] Notificacao de teste recebida

**Edge cases:**
- E se o Gradle falhar por versao incompativel de JDK: usar o JDK incluido no Android Studio (JDK 17+)
- E se o `google-services.json` nao estiver na pasta correta: colocar em `android/app/google-services.json`
- E se o build falhar por dependencias desatualizadas: executar `npx cap sync android` novamente apos atualizar as dependencias

---

### Feature 4.4 — Build iOS (Codemagic)

**Categoria**: build + integracao

**Descricao**: Gerar o IPA para iOS usando o Codemagic (servico de CI/CD em nuvem — nao requer Mac).

**Steps:**

1. Jorge cria conta no Codemagic: `codemagic.io` (plano gratuito)

2. Jorge envia o codigo atualizado para um repositorio GitHub privado (se ainda nao existir):
   - Criar repositorio `fiado-pro` no GitHub
   - Fazer push do codigo da VPS
   - Garantir que `.env` e `android/app/release/*.jks` NAO estao no repositorio

3. Jorge cria conta Apple Developer (`developer.apple.com`, $99/ano).

4. No Codemagic:
   - Conectar o repositorio GitHub
   - Selecionar o projeto como "React Native / Capacitor"
   - Configurar os certificados iOS (Distribution Certificate + Provisioning Profile)
   - Configurar as variaveis de ambiente necessarias (FIREBASE_*, API keys)

5. Configurar o arquivo `codemagic.yaml` na raiz do projeto (Codemagic usa esse arquivo para saber como buildar):
   ```yaml
   workflows:
     ios-release:
       name: iOS Release
       environment:
         xcode: latest
         node: 18
       scripts:
         - cd frontend && npm install
         - cd frontend && npm run build
         - cd frontend && npx cap sync ios
         - cd frontend/ios/App && pod install
       artifacts:
         - frontend/ios/App/build/ios/ipa/*.ipa
       publishing:
         app_store_connect:
           api_key: $APP_STORE_CONNECT_API_KEY
   ```
   Nota: a pasta `ios/` pode precisar ser gerada primeiro com `npx cap add ios` — isso requer ser executado no Codemagic, nao localmente.

6. Executar o build no Codemagic e aguardar.

7. IPA gerado e enviado automaticamente para o TestFlight.

8. Jorge testa o app no TestFlight via iPad Pro.

**Criterios de aceite:**
- [ ] Build iOS concluido no Codemagic sem erros
- [ ] IPA enviado para TestFlight
- [ ] App disponivel no TestFlight para teste
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no TestFlight

**Edge cases:**
- E se o Codemagic apresentar erros de certificado: seguir documentacao oficial `docs.codemagic.io/code-signing/ios-code-signing`
- E se a pasta `ios/` nao existir: precisa ser gerada pelo Codemagic com `npx cap add ios` na primeira execucao
- E se o build falhar por versao de Xcode incompativel: especificar versao explicita no `codemagic.yaml`

---

### Feature 4.5 — Publicar Play Store

**Categoria**: infra (manual — responsabilidade de Jorge)

**Steps:**

1. Jorge cria conta Google Play Console (`play.google.com/console`, taxa unica de $25).

2. Criar novo app: "Fiado Pro", idioma padrao "Portugues (Brasil)", tipo "App", gratis.

3. Preencher todas as secoes obrigatorias:
   - **Presenca na Play Store**: titulo "Fiado Pro", descricao curta (max 80 chars), descricao longa (max 4000 chars), screenshots, feature graphic, icone
   - **Classificacao do conteudo**: responder ao questionario — resultado esperado: "Everyone"
   - **Publico-alvo**: adultos (18+)
   - **Data Safety**: declarar os dados coletados conforme Secao 12 do PRD
   - **Politica de Privacidade**: inserir URL `https://www.fiadopro.com.br/privacidade`

4. Upload do AAB: `Producao > Criar nova versao > Upload do arquivo .aab`

5. Rever e submeter para revisao.

**Criterios de aceite:**
- [ ] App submetido ao Google Play Console
- [ ] Data Safety preenchido
- [ ] Todos os assets visuais enviados
- [ ] URL de politica de privacidade preenchida

---

### Feature 4.6 — Publicar App Store

**Categoria**: infra (manual — responsabilidade de Jorge)

**Steps:**

1. Jorge acessa App Store Connect (`appstoreconnect.apple.com`) com a conta Apple Developer.

2. Criar novo app: "Fiado Pro", bundle ID `br.com.fiadopro.app`, SKU "fiado-pro-001".

3. Preencher todas as secoes:
   - **Informacoes do app**: nome, subtitulo, descricao, palavras-chave, URL de suporte, URL de politica de privacidade
   - **App Review Information**: dados de contato + Review Notes (usar o texto do PRD Secao 13) + credenciais da conta de teste
   - **App Privacy**: preencher Privacy Labels conforme Secao 12 do PRD
   - **Classificacao etaria**: 4+

4. Selecionar o build enviado pelo Codemagic via TestFlight.

5. Submeter para revisao.

**Review Notes a incluir** (do PRD v2.0):
> "Fiado Pro uses native Push Notifications to alert merchants about overdue credits, Haptic Feedback for transaction confirmations, and network status management for offline scenarios. The app solves a specific informal credit management problem for small Brazilian merchants that would not be possible via website alone. Account deletion is available in Settings > Delete my account, as required by Guideline 5.1.1(v)."

**Criterios de aceite:**
- [ ] App submetido ao App Store Connect
- [ ] Privacy Labels preenchidos
- [ ] Review Notes com descricao do uso de notificacoes e exclusao de conta
- [ ] Credenciais de conta de teste incluidas nas Review Notes

---

### Criterios de aceite — Sprint 4 completa

- [ ] Build AAB Android gerado sem erros pelo Android Studio
- [ ] App instalado e testado em dispositivo Android real (login + clientes + fiados)
- [ ] Build IPA iOS gerado pelo Codemagic sem erros
- [ ] App disponivel no TestFlight (login + clientes + fiados)
- [ ] App submetido ao Google Play Console com todos os formularios preenchidos
- [ ] App submetido ao App Store Connect com todos os formularios preenchidos

---

## API Spec

| Metodo | Rota | Descricao | Auth |
|---|---|---|---|
| POST | /api/auth/login | Login com email/senha — retorna httpOnly cookie | Nao |
| POST | /api/auth/google | Login com Google — retorna httpOnly cookie | Nao |
| POST | /api/auth/refresh | Renova o JWT via cookie existente | Cookie |
| POST | /api/auth/logout | Limpa o cookie de autenticacao | Cookie |
| DELETE | /api/users/me | Exclui a conta do usuario autenticado | Cookie |
| POST | /api/notifications/register | Registra token FCM do dispositivo | Cookie |
| GET | /.well-known/assetlinks.json | Android App Links verification | Nao |
| GET | /.well-known/apple-app-site-association | iOS Universal Links verification | Nao |

---

### POST /api/auth/login

**Request:**
```json
{
  "email": "string (obrigatorio)",
  "password": "string (obrigatorio)"
}
```

**Response 200:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string"
  }
}
```
Header: `Set-Cookie: fiado_token=<jwt>; HttpOnly; Secure; SameSite=None; Path=/`

**Response 401:**
```json
{ "success": false, "error": "Email ou senha incorretos" }
```

**Response 400:**
```json
{ "success": false, "error": "Email e senha sao obrigatorios" }
```

---

### POST /api/auth/refresh

**Request:** sem body (usa cookie automaticamente)

**Response 200:**
```json
{ "success": true }
```
Header: `Set-Cookie: fiado_token=<novo_jwt>; HttpOnly; Secure; SameSite=None; Path=/`

**Response 401:**
```json
{ "success": false, "error": "Sessao expirada. Faca login novamente." }
```

---

### DELETE /api/users/me

**Request:**
```json
{
  "password": "string (obrigatorio)"
}
```

**Response 200:**
```json
{ "success": true, "message": "Conta excluida com sucesso" }
```

**Response 403:**
```json
{ "success": false, "error": "Senha incorreta" }
```

**Response 404:**
```json
{ "success": false, "error": "Conta nao encontrada" }
```

---

### POST /api/notifications/register

**Request:**
```json
{
  "token": "string (obrigatorio) — token FCM do dispositivo",
  "platform": "android | ios (obrigatorio)"
}
```

**Response 200:**
```json
{ "success": true }
```

**Response 400:**
```json
{ "success": false, "error": "Token e plataforma sao obrigatorios" }
```

---

## Data Models

### Modificacao: tabela `users`

| Coluna | Tipo | Constraints | Descricao |
|---|---|---|---|
| deleted_at | TIMESTAMPTZ | DEFAULT NULL | Timestamp do soft delete |
| deleted_reason | TEXT | DEFAULT NULL | Motivo informado pelo usuario (opcional) |
| consent_at | TIMESTAMPTZ | DEFAULT NULL | Timestamp do consentimento LGPD |
| consent_ip | VARCHAR(45) | DEFAULT NULL | IP do dispositivo no momento do cadastro |

**Migration**: `001_add_user_deletion_fields.sql` + `003_add_consent_fields.sql`
**Indices**: `idx_users_deleted_at` (parcial, WHERE deleted_at IS NULL) — acelera busca de usuarios ativos

---

### Nova tabela: `device_tokens`

| Coluna | Tipo | Constraints | Descricao |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Identificador unico |
| user_id | UUID | NOT NULL, FK users(id) ON DELETE CASCADE | Usuario proprietario do dispositivo |
| token | TEXT | NOT NULL | Token FCM do dispositivo |
| platform | VARCHAR(10) | NOT NULL, CHECK IN ('android', 'ios') | Plataforma do dispositivo |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Data de registro |

**Constraints**: UNIQUE(user_id, token)
**Indices**: `idx_device_tokens_user_id`
**Migration**: `002_add_device_tokens.sql`

---

## Notas de Arquitetura

- **Pasta dist/ na raiz e intocavel**: `/srv/projetos/clientes/fiado-pro/dist/` e o volume montado pelo nginx para servir o frontend web. O Capacitor usa `frontend/dist/` (dentro da pasta frontend). Sao caminhos diferentes — nunca confundir.

- **Cookie httpOnly com SameSite=None**: necessario porque o Capacitor faz requisicoes cross-origin (o webview carrega de `capacitor://localhost` mas chama a API em `https://www.fiadopro.com.br`). SameSite=None exige Secure=true, que so funciona em HTTPS — em desenvolvimento local usar SameSite=Lax e Secure=false.

- **Soft delete em vez de hard delete**: preserva integridade referencial com tabelas relacionadas (fiados, pagamentos, device_tokens). Simplifica auditoria. O ON DELETE CASCADE na FK de device_tokens garante que os tokens sao removidos junto com o usuario — ajustar se necessario.

- **Firebase Admin SDK**: inicializar uma unica instancia no startup do servidor (singleton), nao a cada chamada. Credenciais via variaveis de ambiente, nunca hardcoded.

- **Job de push notifications**: usar `node-cron` para simplicidade. Se o volume de usuarios crescer, migrar para uma fila (Bull/BullMQ com Redis) — o Redis ja esta na stack do projeto (Metodo Planejar), verificar se esta disponivel no Fiado Pro tambem.

- **`npx cap sync android` deve ser executado sempre apos**: instalar novos plugins Capacitor, alterar `capacitor.config.ts`, e antes de qualquer build Android.

- **Anti-patterns a evitar**:
  - Nunca colocar `server: { url: 'https://...' }` no `capacitor.config.ts` — causa rejeicao nas stores
  - Nunca armazenar JWT no localStorage — vulneravel a XSS
  - Nunca enviar `.env` para o repositorio
  - Nunca remover a pasta `dist/` da raiz sem antes rodar `npm run build`

---

## Compliance

- [x] LGPD aplicavel: Fiado Pro armazena dados pessoais de clientes dos lojistas (nome, telefone, historico de credito)
  - [x] Politica de Privacidade publicada em URL publica (Sprint 3)
  - [x] Consentimento registrado no cadastro com timestamp e IP (Sprint 3)
  - [x] Direito de exclusao implementado via `DELETE /api/users/me` + botao no app (Sprint 1)
  - [x] Email de confirmacao de exclusao enviado ao usuario (Sprint 1)
- [ ] CVM175: Nao aplicavel — Fiado Pro nao envolve recomendacao financeira

---

## Historico de versoes

| Versao | Data | O que mudou |
|---|---|---|
| 1.0 | 2026-04-13 | Versao inicial gerada a partir do PRD v2.0 aprovado |
| 1.0.1 | 2026-04-21 | Sprint 1 — adicionada Feature 1.4: Password hashing PBKDF2 → Argon2 (state-of-the-art obrigatorio antes de App Store/Play Store) |
