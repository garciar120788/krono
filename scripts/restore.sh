#!/usr/bin/env bash
# Restaura un respaldo creado con backup.sh
# Uso:  ./scripts/restore.sh backups/krono_2026-11-03_120000.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Uso: ./scripts/restore.sh backups/ARCHIVO.sql.gz" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_USER="${POSTGRES_USER:-krono}"
DB_NAME="${POSTGRES_DB:-krono}"

read -r -p "Esto reemplazará los datos actuales con $FILE. ¿Continuar? [s/N] " ok
case "$ok" in
  s|S|si|SI|sí|Sí) ;;
  *) echo "Cancelado."; exit 0 ;;
esac

docker compose stop web
gunzip -c "$FILE" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"
docker compose start web

echo "Respaldo restaurado."
