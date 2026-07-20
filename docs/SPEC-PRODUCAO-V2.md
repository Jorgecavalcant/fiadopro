# SPEC — Fiado Pro V2 (Sprint Produção)

> Contratos compartilhados entre as frentes de trabalho paralelas.
> Qualquer frente que precise divergir disto DEVE registrar o motivo no PR.

## Arquitetura atual (não quebrar)

- **Frontend**: React 18 + TS + Vite, SPA. `frontend/src/App.tsx` é um monólito de ~3.7k linhas.
  Dados de negócio hoje vivem em `localStorage` (`fiado_pro_data_v14`).
- **Backend**: Express + TS (ESM, imports com sufixo `.js`), PostgreSQL 16 via `pg` (`query()` em
  `src/config/database.ts`), Zod para validação, `requireAuth` (JWT em cookie httpOnly `fiado_token`).
- **Deploy**: CI GitHub Actions → VPS. Produção `www.fiadopro.com.br`, staging `fiadopro.jcplanejamento.com.br`.

## Regras de convivência entre frentes

1. **Migrations com número reservado por frente** (arquivos em `backend/migrations/`, SQL idempotente
   — `IF NOT EXISTS` sempre que possível; rodam via runner com `ON_ERROR_STOP`):
   - `002_server_sync.sql` + `003_vinculo_aprovacao.sql` → frente CORE
   - `004_admin_settings.sql` → frente ADMIN
   - `005_ai_config.sql` → frente IA
   - `006_billing.sql` → frente BILLING
2. **App.tsx: toque mínimo.** Componentes novos SEMPRE em `frontend/src/components/<Nome>.tsx`.
   No App.tsx apenas: import, estado mínimo e ponto de render. Nada de blocos de lógica novos lá.
3. **Envelope de API**: `{ success: boolean, ...dados }` em sucesso; erros via
   `next(new ApiError(status, mensagem, 'CODIGO'))` (padrão existente).
4. **Sem segredo em código/repo.** Configuração só por `process.env.*`; documentar variáveis novas
   no PR e em `.env.example`.
5. **Testes**: precisam rodar SEM banco e SEM rede (mockar `query()` com `vitest`). Backend:
   `npm test` = `vitest run --passWithNoTests`. Nada de testes que dependem de Postgres vivo.
6. **Sem `console.log` novo** no frontend; backend usa `console.error` para erros (padrão atual).

## Contratos da frente CORE (base para as demais)

### Migration 002 — dados no servidor
- `customers`: `id uuid pk`, `owner_user_id uuid fk users`, `linked_user_id uuid fk users null`,
  `name`, `phone`, `email null`, `pix_key null`, `trusted bool default false`,
  `overpayment_strategy text default 'RETURN'`, `notes jsonb default '[]'`, `score int null`,
  `created_at`, `updated_at`, `deleted_at timestamptz null`.
  Índices: `(owner_user_id)`, `(linked_user_id)`, `(phone)`, `(email)`.
- `transactions`: `id uuid pk`, `customer_id uuid fk customers`, `owner_user_id uuid fk users`,
  `type text check in ('DEBT','PAYMENT','REFUND','ABATIMENTO')`,
  `status text check in ('CONFIRMED','PENDING','REJECTED') default 'CONFIRMED'`,
  `amount numeric(12,2)`, `description text`, `occurred_at timestamptz`, `due_date timestamptz null`,
  `payment_method text null`, `attachment jsonb null` (`{data,mimeType,name}`, base64 ≤ 10MB),
  `installment_number int null`, `total_installments int null`, `installment_group_id uuid null`,
  `interest_rate numeric(5,2) null`, `created_at`, `updated_at`.
- `users`: `ADD COLUMN role text NOT NULL DEFAULT 'user'` (+ índice). Bootstrap: na subida do
  backend, se `ADMIN_EMAIL` estiver definido, promover esse usuário a `role='admin'` (idempotente).

### Migration 003 — vínculo e aprovação
- Vínculo: quando `customers.phone` OU `customers.email` bate com `users.phone`/`users.email`
  (usuário ativo, não deletado), setar `linked_user_id`. Gatilhos de recalculo: criação/edição de
  customer, registro de usuário e atualização de perfil (`PATCH /api/users/me` — criar se faltar).
- `transactions.status`: lançamento criado contra customer **vinculado** nasce `PENDING`;
  contra não-vinculado nasce `CONFIRMED`.
- `transaction_events`: `id`, `transaction_id fk`, `actor_user_id`, `action text check in
  ('CREATED','APPROVED','REJECTED','RESENT')`, `created_at` (trilha de auditoria).

### Endpoints CORE
- `GET/POST /api/customers`, `GET/PATCH/DELETE /api/customers/:id` (escopo: `owner_user_id = eu`;
  DELETE = soft delete).
- `GET/POST /api/transactions?customer_id=`, `PATCH /api/transactions/:id`.
- `POST /api/sync/import` — importação em lote do estado localStorage (idempotente por `id`).
- `GET /api/inbox` — lançamentos `PENDING` contra MIM (sou `linked_user_id` do customer).
- `POST /api/transactions/:id/approve` | `/reject` (só o usuário vinculado) | `/resend`
  (só o dono; volta REJECTED → PENDING; registrar em `transaction_events`).
- `GET /api/counterpart` — minha visão como cliente: por dono (nome/telefone), saldo a
  pagar/receber calculado só com `CONFIRMED`.
- `requireAdmin` middleware em `src/middleware/auth.ts` (checa `role='admin'` no banco).

### Env novas (CORE)
`ADMIN_EMAIL` (bootstrap do admin).

## Frente ADMIN (consome CORE)
- Migration `004`: `app_settings (key text pk, value jsonb, updated_at)`.
- Rotas `/api/admin/*` com `requireAuth + requireAdmin`: listar/editar usuários (sem expor hash),
  ativar/desativar, reset de senha por e-mail, métricas (contagens, volume), configurações
  (`GET/PUT /api/admin/settings/:key`), relatórios até 5 anos.
- Frontend: `components/AdminPanel.tsx`; botão "Admin" no menu SÓ se `/api/auth/me` retornar
  `role='admin'` (backend nunca confia no frontend para autorização).

## Frente IA (OpenRouter)
- Migration `005`: `ai_config (id smallint pk default 1 check (id=1), chat_model text,
  vision_model text, enabled bool default true, updated_at)` — defaults de modelos GRATUITOS.
- Backend `src/services/openrouter.ts` + rotas `/api/ai/*` (requireAuth): análise de cliente
  (substitui o Gemini client-side), leitura de documento/imagem (≤10MB, valida mime e tamanho)
  para pré-preencher lançamento. Rate limit por usuário. `ai_config` editável via
  `/api/admin/ai-config` (requireAdmin — a UI fica no AdminPanel, expor componente
  `components/AdminAIConfig.tsx` para o painel montar).
- Frontend: `services/aiService.ts` chama o BACKEND (nunca OpenRouter direto);
  substituir usos de `geminiService.ts` e removê-lo.
- Env: `OPENROUTER_API_KEY` (⚠️ NUNCA no bundle/`define` do Vite).

## Frente BILLING (Asaas)
- Migration `006`: `subscriptions (id uuid pk, user_id fk unique, plan text check in
  ('FREE','PRO') default 'FREE', asaas_customer_id text null, asaas_subscription_id text null,
  status text, current_period_end timestamptz null, created_at, updated_at)`.
- Backend `src/services/asaas.ts` + rotas: `POST /api/billing/subscribe` (cria cliente+assinatura
  Asaas, retorna link de pagamento), `GET /api/billing/status`, webhook
  `POST /api/billing/webhook/asaas` (valida token do header `asaas-access-token` contra
  `ASAAS_WEBHOOK_TOKEN`; atualiza plano).
- Gate de plano (helper `getUserPlan(userId)`): FREE = relatórios 6 meses; PRO = 12 meses;
  admin = 60 meses. Exportar helper para as outras frentes usarem.
- Frontend: `components/UpgradePlano.tsx` (estado do plano + botão assinar + retorno).
- Env: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_BASE_URL` (sandbox/prod).

## Frente FRONTEND-SYNC (consome CORE)
- `services/syncService.ts`: servidor = fonte de verdade quando logado; localStorage vira cache
  offline. Primeira sessão logada com dados locais → `POST /api/sync/import` (migração transparente).
- UI: aba/badge "Aprovações" (inbox), aprovar/recusar com motivo, visão "Minhas dívidas"
  (counterpart), estado PENDING/REJECTED visível nos lançamentos do dono, botão reenviar,
  botão "entrar em contato" (WhatsApp — usar `buildChargeMessage`/`normalizeWhatsAppPhone`
  existentes em `utils/credit.ts`).
