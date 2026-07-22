#!/usr/bin/env bash
# Ежедневный бэкап PostgreSQL с ротацией (требование ТЗ §6 — резервное копирование ≥1/сутки).
# Ставится в cron:  0 3 * * *  /opt/ithona/app/deploy/backup.sh >> /var/log/ithona-backup.log 2>&1
set -euo pipefail

APP_DIR="/opt/ithona/app"        # где лежит docker-compose.yml
BACKUP_DIR="/opt/ithona/backups" # куда складывать дампы
KEEP_DAYS=14                     # сколько дней хранить

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

# Берём креды БД из .env рядом с compose
set -a
# shellcheck disable=SC1091
source .env
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT"

# Ротация: удаляем дампы старше KEEP_DAYS
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup ok → $OUT ($(du -h "$OUT" | cut -f1))"
