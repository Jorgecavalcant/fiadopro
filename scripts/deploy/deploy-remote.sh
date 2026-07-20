#!/usr/bin/env bash
# =================================================================
# Fiado Pro — Deploy remoto (executado NA VPS pelo GitHub Actions)
# Uso: bash deploy-remote.sh <dir-da-release-extraida>
#
# Etapas: backup (banco + arquivos) → sync de arquivos → migrations
#         → rebuild da API → healthcheck → rollback em caso de falha
# =================================================================
set -euo pipefail

RELEASE_DIR="${1:?Uso: deploy-remote.sh <release-dir>}"
DEPLOY_DIR="/srv/projetos/clientes/fiado-pro"
BACKUP_DIR="/srv/projetos/backups/fiado-pro"
TS="$(date +%Y%m%d-%H%M%S)"
DB_CONTAINER="fiado-pro-db"
DB_USER="fiado_user"
DB_NAME="fiado_pro"

log() { echo "[deploy $(date +%H:%M:%S)] $*"; }

mkdir -p "$BACKUP_DIR"

# -----------------------------------------------------------------
# 1. BACKUPS (banco + arquivos) — nada é destruído sem cópia
# -----------------------------------------------------------------
log "Backup do banco → $BACKUP_DIR/db-$TS.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db-$TS.sql.gz"
[ -s "$BACKUP_DIR/db-$TS.sql.gz" ] || { log "ERRO: dump do banco vazio — abortando"; exit 1; }

log "Backup dos arquivos → $BACKUP_DIR/files-$TS.tar.gz"
tar czf "$BACKUP_DIR/files-$TS.tar.gz" -C "$DEPLOY_DIR" \
  --exclude='node_modules' --exclude='data' --exclude='logs' \
  backend dist docker-compose.yml nginx.conf 2>/dev/null

# Retenção: manter os 10 backups mais recentes de cada tipo
ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/files-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

rollback() {
  log "!!! FALHA NO DEPLOY — iniciando rollback dos arquivos"
  tar xzf "$BACKUP_DIR/files-$TS.tar.gz" -C "$DEPLOY_DIR"
  (cd "$DEPLOY_DIR" && docker compose build api && docker compose up -d api) || true
  log "Rollback concluído. Banco NÃO foi revertido (dump disponível: db-$TS.sql.gz)."
  exit 1
}
trap rollback ERR

# -----------------------------------------------------------------
# 2. SYNC DE ARQUIVOS (preserva .env, data/, logs/)
# -----------------------------------------------------------------
log "Sincronizando arquivos da release"
rsync -a --delete "$RELEASE_DIR/backend/src/" "$DEPLOY_DIR/backend/src/"
rsync -a --delete "$RELEASE_DIR/backend/migrations/" "$DEPLOY_DIR/backend/migrations/"
rsync -a --delete "$RELEASE_DIR/scripts/deploy/" "$DEPLOY_DIR/scripts/deploy/"
cp "$RELEASE_DIR/backend/package.json" "$RELEASE_DIR/backend/package-lock.json" \
   "$RELEASE_DIR/backend/tsconfig.json" "$RELEASE_DIR/backend/Dockerfile" "$DEPLOY_DIR/backend/"
cp "$RELEASE_DIR/docker-compose.yml" "$RELEASE_DIR/nginx.conf" "$RELEASE_DIR/db-init.sql" "$DEPLOY_DIR/"

# -----------------------------------------------------------------
# 3. MIGRATIONS (rastreadas em schema_migrations, ON_ERROR_STOP)
# -----------------------------------------------------------------
log "Aplicando migrations pendentes"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());"

for f in "$RELEASE_DIR"/backend/migrations/*.sql; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  applied=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '$name'")
  if [ "$applied" = "1" ]; then
    log "  - $name (já aplicada)"
  else
    log "  + $name"
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$f"
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -c \
      "INSERT INTO schema_migrations (filename) VALUES ('$name');"
  fi
done

# -----------------------------------------------------------------
# 4. FRONTEND (dist é servido direto pelo nginx via bind mount)
# -----------------------------------------------------------------
log "Publicando frontend (dist)"
rsync -a --delete "$RELEASE_DIR/dist/" "$DEPLOY_DIR/dist/"

# -----------------------------------------------------------------
# 5. BACKEND — rebuild + restart
# -----------------------------------------------------------------
log "Rebuild da API"
cd "$DEPLOY_DIR"
docker compose build api
docker compose up -d api

# -----------------------------------------------------------------
# 6. HEALTHCHECK (com retry) — falha dispara rollback via trap
# -----------------------------------------------------------------
log "Healthcheck da API"
ok=""
for i in $(seq 1 15); do
  sleep 4
  if curl -sf http://127.0.0.1:10004/api/health > /dev/null; then ok=1; break; fi
  log "  tentativa $i/15..."
done
[ -n "$ok" ] || { log "API não respondeu ao healthcheck"; false; }

curl -sf http://127.0.0.1:10003/ > /dev/null || { log "Frontend (nginx) não respondeu"; false; }

trap - ERR
log "✅ Deploy concluído com sucesso (backup: $TS)"
