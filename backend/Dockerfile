# DECISAO (chore/setup-pnpm-workspaces): este Dockerfile continua em npm de
# proposito. O build de producao recebe via tar/scp apenas backend/src,
# backend/migrations, backend/package.json e backend/package-lock.json
# (ver scripts/deploy/deploy-remote.sh e deploy-staging.sh) - nao o
# workspace inteiro nem o pnpm-lock.yaml da raiz. Trocar para pnpm aqui
# exigiria levar pnpm-workspace.yaml + pnpm-lock.yaml da raiz para dentro
# do payload e do contexto de build, o que acopla o Dockerfile ao
# monorepo sem necessidade. pnpm e usado para dev/CI; o container de
# producao roda com um package-lock.json proprio do backend, mantido
# manualmente com `npm install --package-lock-only` sempre que
# backend/package.json mudar.
FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (dev incluídas — tsc é necessário para o build;
# npm prune --omit=dev abaixo remove tudo que é dev da imagem final)
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# Remove source files
RUN rm -rf src *.ts

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start app
CMD ["npm", "start"]
