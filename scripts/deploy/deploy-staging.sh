#!/usr/bin/env bash
# =================================================================
# Fiado Pro — Deploy de STAGING (executado NA VPS)
# Uso: bash deploy-staging.sh <dir-da-release-extraida>
#
# Staging: fiadopro.jcplanejamento.com.br
# Dir:     /srv/projetos/clientes/fiado-pro-staging
# Isolado da produção (containers, volume e .env próprios).
# =================================================================
set -euo pipefail

RELEASE_DIR="${1:?Uso: deploy-staging.sh <release-dir>}"
DEPLOY_DIR="/srv/projetos/clientes/fiado-pro-staging"
PROD_ENV="/srv/projetos/clientes/fiado-pro/.env"
DB_CONTAINER="fiado-pro-staging-db"
DB_USER="fiado_user"
DB_NAME="fiado_pro"

log() { echo "[staging $(date +%H:%M:%S)] $*"; }

mkdir -p "$DEPLOY_DIR/backend" "$DEPLOY_DIR/scripts/deploy" "$DEPLOY_DIR/dist"

# -----------------------------------------------------------------
# 1. .env de staging — auto-provisiona no primeiro deploy
#    (segredos próprios; OAuth/Resend herdados do .env de produção)
# -----------------------------------------------------------------
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  log "Provisionando .env de staging (primeira execução)"
  [ -f "$PROD_ENV" ] || { log "ERRO: .env de produção não encontrado"; exit 1; }
  grep -E '^(GOOGLE_API_KEY|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|RESEND_API_KEY)=' "$PROD_ENV" > "$DEPLOY_DIR/.env"
  echo "DB_PASSWORD=$(openssl rand -hex 24)" >> "$DEPLOY_DIR/.env"
  echo "JWT_SECRET=$(openssl rand -hex 32)" >> "$DEPLOY_DIR/.env"
  chmod 600 "$DEPLOY_DIR/.env"
fi

# -----------------------------------------------------------------
# 2. Sync de arquivos
# -----------------------------------------------------------------
log "Sincronizando arquivos da release"
rsync -a --delete "$RELEASE_DIR/backend/src/" "$DEPLOY_DIR/backend/src/"
rsync -a --delete "$RELEASE_DIR/backend/migrations/" "$DEPLOY_DIR/backend/migrations/"
rsync -a --delete "$RELEASE_DIR/scripts/deploy/" "$DEPLOY_DIR/scripts/deploy/"
cp "$RELEASE_DIR/backend/package.json" "$RELEASE_DIR/backend/package-lock.json" \
   "$RELEASE_DIR/backend/tsconfig.json" "$RELEASE_DIR/backend/Dockerfile" "$DEPLOY_DIR/backend/"
cp "$RELEASE_DIR/docker-compose.staging.yml" "$RELEASE_DIR/nginx.conf" "$RELEASE_DIR/db-init.sql" "$DEPLOY_DIR/"
rsync -a --delete "$RELEASE_DIR/dist/" "$DEPLOY_DIR/dist/"

# -----------------------------------------------------------------
# 3. Subir stack (build + up) — primeiro up cria e inicializa o banco
# -----------------------------------------------------------------
cd "$DEPLOY_DIR"
log "Build + up da stack de staging"
docker compose -f docker-compose.staging.yml build api
docker compose -f docker-compose.staging.yml up -d

# Aguardar banco saudável antes das migrations
for i in $(seq 1 15); do
  state=$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo starting)
  [ "$state" = "healthy" ] && break
  sleep 3
done

# -----------------------------------------------------------------
# 4. Migrations (mesmo runner da produção)
# -----------------------------------------------------------------
log "Aplicando migrations"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());"
for f in "$RELEASE_DIR"/backend/migrations/*.sql; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  applied=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '$name'")
  if [ "$applied" != "1" ]; then
    log "  + $name"
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$f"
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c \
      "INSERT INTO schema_migrations (filename) VALUES ('$name');"
  fi
done

# Reiniciar API para garantir que pegou o código novo
docker compose -f docker-compose.staging.yml restart api > /dev/null 2>&1 || true

# -----------------------------------------------------------------
# 5. Healthcheck
# -----------------------------------------------------------------
log "Healthcheck"
ok=""
for i in $(seq 1 15); do
  sleep 4
  if curl -sf http://127.0.0.1:10014/api/health > /dev/null; then ok=1; break; fi
  log "  tentativa $i/15..."
done
[ -n "$ok" ] || { log "ERRO: API de staging não respondeu"; exit 1; }
curl -sf http://127.0.0.1:10013/ > /dev/null || { log "ERRO: web de staging não respondeu"; exit 1; }

log "✅ Staging no ar: https://fiadopro.jcplanejamento.com.br"
