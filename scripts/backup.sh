#!/usr/bin/env bash
# Crea un respaldo comprimido de la base de datos de Krono en ./backups
# Uso:  ./scripts/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_USER="${POSTGRES_USER:-krono}"
DB_NAME="${POSTGRES_DB:-krono}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="backups/krono_${STAMP}.sql.gz"

mkdir -p backups
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists | gzip > "$OUT"

echo "Respaldo creado: $OUT"

# Conserva solo los 30 respaldos más recientes
ls -1t backups/krono_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
