#!/usr/bin/env bash
set -euo pipefail

if [[ "${CONFIRM:-}" != "YES_RESET_FIADO_PRO" ]]; then
  echo "Refusing to reset: set CONFIRM=YES_RESET_FIADO_PRO to authorize this operation." >&2
  exit 1
fi

echo "WARNING: This permanently deletes Fiado Pro application data." >&2
echo "Take and verify a database backup before continuing." >&2

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

{
  printf "SET app.allow_fiado_reset = 'YES_RESET_FIADO_PRO';\n"
  cat "${script_dir}/reset-banco-fiado.sql"
} | docker exec -i fiado-pro-db psql \
  -U fiado_user \
  -d fiado_pro \
  -v ON_ERROR_STOP=1
