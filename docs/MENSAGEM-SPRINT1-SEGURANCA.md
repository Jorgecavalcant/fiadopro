# MENSAGEM PARA ABRIR SESSAO — Sprint 1: Seguranca

Copie TUDO abaixo e cole na nova sessao do Claude Code:

---

/jc

## CONTEXTO DA SESSAO

Estou abrindo uma sessao limpa de **Implementacao (Fase I do Protocolo RPI)** para o **Fiado Pro**.
Esta e a **Sprint 1 — Seguranca**, a primeira de 4 sprints do empacotamento mobile.

**ANTES DE QUALQUER CODIGO, leia estes arquivos nesta ordem:**

### Documentos obrigatorios (ler primeiro)
1. `D:\TECH42\PROJETOS\fiado-pro\STATE.md` — estado atual do projeto
2. `D:\TECH42\PROJETOS\fiado-pro\docs\PRD-empacotamento-mobile-v2.0.md` — PRD aprovado
3. `D:\TECH42\PROJETOS\fiado-pro\docs\SPEC-empacotamento-mobile-v1.0.md` — SPEC com os 4 sprints detalhados
4. `D:\TECH42\METODOLOGIA\03-FLUXO-DESENVOLVIMENTO-JC.md` — fluxo de desenvolvimento

### Codigo a ler na VPS (jorge@46.224.55.18)
5. `/srv/projetos/clientes/fiado-pro/backend/src/routes/auth.ts` — rotas de autenticacao
6. `/srv/projetos/clientes/fiado-pro/backend/src/middleware/auth.ts` — middleware JWT
7. `/srv/projetos/clientes/fiado-pro/backend/src/utils/jwt.ts` — utilitarios JWT
8. `/srv/projetos/clientes/fiado-pro/backend/src/server.ts` — servidor Express
9. `/srv/projetos/clientes/fiado-pro/backend/src/services/email.ts` — servico de email
10. `/srv/projetos/clientes/fiado-pro/frontend/src/App.tsx` — componente principal do frontend
11. `/srv/projetos/clientes/fiado-pro/docker-compose.yml` — Docker Compose com secrets hardcoded
12. `/srv/projetos/clientes/fiado-pro/backend/.env` — variaveis de ambiente atuais

---

## O QUE ESTA SPRINT DEVE ENTREGAR

### 1.1 — JWT: migrar de localStorage para httpOnly cookie
- Backend: ao fazer login (POST /api/auth/login e POST /api/auth/google), retornar JWT via Set-Cookie httpOnly em vez de body
- Backend: middleware auth.ts deve ler JWT do cookie (nao mais do Authorization header)
- Backend: configurar CORS com `credentials: true`
- Backend: criar endpoint POST /api/auth/refresh para renovar token via cookie
- Frontend: remover localStorage.setItem/getItem do JWT
- Frontend: adicionar `credentials: 'include'` em todas as chamadas fetch
- **ATENCAO:** Cookie precisa de `SameSite=None; Secure=true` para funcionar com Capacitor (cross-origin)

### 1.2 — Secrets: mover do docker-compose.yml para .env
- Criar `/srv/projetos/clientes/fiado-pro/.env` (raiz do projeto) com TODAS as variaveis sensiveis
- No docker-compose.yml: substituir valores hardcoded por `${VARIAVEL}` referenciando o .env
- Variaveis a mover: DB_PASSWORD, GOOGLE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, RESEND_API_KEY
- Adicionar .env ao .gitignore
- Criar .env.example com as chaves sem valores

### 1.3 — Exclusao de conta (Apple guideline 5.1.1(v))
- Backend: endpoint DELETE /api/users/me — exigir confirmacao de senha no body
- Backend: soft delete — adicionar coluna `deleted_at` e `deleted_reason` na tabela users (migration PostgreSQL)
- Backend: anonimizar dados pessoais (nome, telefone, email) ao excluir
- Backend: enviar email de confirmacao de exclusao via Resend
- Frontend: botao "Excluir minha conta" na tela de configuracoes/perfil
- Frontend: modal de confirmacao pedindo senha + motivo (opcional)

---

## REGRAS DA SESSAO

1. **Usar agentes /jc** — desenvolvedor-backend e desenvolvedor-frontend, com engenheiro-devops para deploy
2. **Trabalhar direto na VPS** — o codigo de producao esta em `/srv/projetos/clientes/fiado-pro/`
3. **Salvar documentacao em 2 lugares** — local (`D:\TECH42\PROJETOS\fiado-pro\docs\`) e VPS (`/srv/projetos/clientes/fiado-pro/docs/`)
4. **Processo de deploy obrigatorio apos cada mudanca:**
   ```
   cd /srv/projetos/clientes/fiado-pro/frontend && npm run build
   cd /srv/projetos/clientes/fiado-pro && docker compose build api
   docker compose up -d
   docker ps | grep fiado  # verificar healthy
   ```
5. **NUNCA remover a pasta `dist/` na raiz** — e o volume montado pelo nginx. Se precisar regenerar: `npm run build` dentro de `frontend/`
6. **Atualizar STATE.md ao final da sprint** — em ambos os lugares (local + VPS)
7. **QA obrigatorio** — esta sprint altera auth/JWT + dados pessoais (LGPD) — criterios C4 e C5 do checklist QA

---

## CRITERIOS DE ACEITE (todos devem passar)

- [ ] Login funciona com JWT em httpOnly cookie (nao mais localStorage)
- [ ] Refresh token funciona via endpoint dedicado
- [ ] Logout limpa o cookie corretamente
- [ ] Todas as rotas protegidas continuam funcionando
- [ ] CORS com credentials: true configurado
- [ ] Secrets removidos do docker-compose.yml
- [ ] .env na raiz do projeto com todas as variaveis
- [ ] .env.example criado
- [ ] .gitignore inclui .env
- [ ] Containers sobem corretamente com o novo .env
- [ ] Endpoint DELETE /api/users/me funcional
- [ ] Botao "Excluir minha conta" visivel na UI
- [ ] Exclusao anonimiza dados pessoais
- [ ] Email de confirmacao de exclusao enviado
- [ ] www.fiadopro.com.br funcionando apos todas as mudancas

---

Comece lendo os documentos, depois execute as 3 entregas na ordem: 1.1 (JWT), 1.2 (secrets), 1.3 (exclusao de conta). Use agentes em paralelo onde possivel.
