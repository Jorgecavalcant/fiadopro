# Contribuindo com o Fiado Pro

Fiado Pro é um app de gestão de crédito ("fiado") para pequenos comerciantes,
mantido pela Tech 42. Este guia descreve como rodar o projeto localmente,
testar e enviar mudanças.

## Requisitos

- **Node.js 20**
- **PostgreSQL 16** (via Docker ou instalação local)
- **Docker** e **Docker Compose** (para rodar o stack completo, igual à produção)

## Rodando localmente

O projeto tem dois pacotes independentes: `backend/` (API Node.js/Express +
TypeScript) e `frontend/` (React + Vite).

### Backend

```bash
cd backend
npm install
npm run dev       # tsx watch src/server.ts — porta 4000
```

O backend espera um PostgreSQL acessível (ver `docker-compose.yml` para as
variáveis de ambiente esperadas: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `JWT_SECRET`, etc.). Para subir só o banco:

```bash
docker compose up -d db
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server
```

### Stack completo (igual produção)

```bash
docker compose up -d
```

Isso sobe banco (`fiado-pro-db`), API (`fiado-pro-api`) e o Nginx servindo o
build estático (`fiado-pro-web`). Lembre-se: o Nginx serve a partir de
`./dist`, que precisa existir e estar atualizado — rode
`cd frontend && npm run build` antes de subir/reiniciar o container `web`
(ver `README.md`).

## Estrutura de branches

- **`main` é produção.** Merge em `main` dispara deploy automático
  (`.github/workflows/deploy.yml`).
- Nenhuma mudança nasce direto em `main`. Toda mudança começa em uma branch
  própria (`feat/...`, `fix/...`, `chore/...`, `claude/...`) e vira Pull
  Request.
- PRs precisam passar no workflow `Validate` (`.github/workflows/validate.yml`):
  scan de segredos (gitleaks), typecheck do backend, e testes + build do
  frontend — incluindo uma checagem de que nenhuma chave de API vazou para o
  bundle do frontend.
- Quem aprova e mergeia é o dono do repositório (`.github/CODEOWNERS`).

## Testes

Ambos os projetos usam [Vitest](https://vitest.dev/).

```bash
cd frontend && npm test    # vitest run
cd backend && npm test     # vitest run --passWithNoTests
```

O frontend tem cobertura real hoje (lógica de crédito em
`frontend/src/utils/credit.ts` — cálculo de score, saldo, mensagem de
cobrança, normalização de telefone). O backend ainda não tem suíte de
testes própria — o CI roda `npm test` mas passa vazio
(`--passWithNoTests`) até que testes sejam adicionados.

## Convenção de commits

O histórico do projeto segue [Conventional Commits](https://www.conventionalcommits.org/),
com mensagens em português, no formato:

```
<tipo>(<escopo opcional>): <descrição em pt-BR>
```

Tipos usados no projeto: `feat`, `fix`, `chore`, `ci`, `docs`, `refactor`.
Exemplos reais do histórico:

```
feat(billing): assinatura Pro via Asaas (Pix/cartão)
fix(auth): forgot-password validava e-mail nao-string incorretamente
fix(critico): perfil do usuario nunca sincronizava com o backend
chore(infra): staging isolado de producao
```

## Fluxo de deploy

- **Staging** (`https://fiadopro.jcplanejamento.com.br`): disparado
  manualmente via GitHub Actions, workflow "Deploy Staging"
  (`workflow_dispatch`) — escolha a branch na UI do Actions antes de abrir o
  PR para testar em ambiente isolado de produção.
- **Produção** (`https://www.fiadopro.com.br`): automática a cada push/merge
  em `main` (`.github/workflows/deploy.yml`), com healthcheck externo pós-deploy.

## Pull Requests

1. Abra a branch a partir de `main` atualizada.
2. Garanta que os testes e o build passam localmente antes de abrir o PR.
3. Descreva o que mudou e por quê — não é necessário um processo formal de
   RFC, mas PRs de mudança de esquema de banco ou de fluxo de auth/pagamento
   devem explicar o racional na descrição do PR.
4. Aguarde o CI (`Validate`) ficar verde.
5. O merge é feito pelo dono do repositório.
