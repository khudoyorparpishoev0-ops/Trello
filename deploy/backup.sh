#!/usr/bin/env bash
# Ежедневный бэкап PostgreSQL с ротацией (требование ТЗ §6 — резервное копирование ≥1/сутки).
# Ставится в cron:  0 3 * * *  /opt/ithona/app/deploy/backup.sh >> /var/log/ithona-backup.log 2>&1
set -euo pipefail

# Пути можно переопределить окружением — это нужно тестам; в cron работают значения по умолчанию.
APP_DIR="${APP_DIR:-/opt/ithona/app}"              # где лежит docker-compose.yml
BACKUP_DIR="${BACKUP_DIR:-/opt/ithona/backups}"    # куда складывать дампы
KEEP_DAYS="${KEEP_DAYS:-14}"                       # сколько дней хранить
MIN_BYTES="${MIN_BYTES:-1024}"                     # дамп меньше килобайта — заведомо пустой

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

# Креды берём из окружения самого контейнера, а не из .env.
#
# Раньше скрипт делал `source .env` — и падал на строке
#   SMTP_FROM=CORE <noreply@ithona.tj>
# со словами «syntax error near unexpected token `newline'»: для bash «<» и «>»
# это перенаправление ввода-вывода. Docker Compose такой файл читает нормально,
# он не shell-скрипт, и заставлять его быть shell-совместимым — лишнее условие,
# о которое споткнётся следующий, кто добавит значение с пробелом или скобкой.
# Контейнеру postgres переменные передаёт compose, поэтому спрашиваем у него.

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

# Пишем во временный файл и переименовываем только готовый дамп.
#
# Прямая запись в $OUT давала две беды. Во-первых, при падении pg_dump в
# каталоге оставался обрезанный архив в пару десятков байт: ротация считала бы
# его нормальным бэкапом и со временем вытеснила рабочие копии, а обнаружилось
# бы это в момент восстановления. Во-вторых, два прогона в одну секунду берут
# одинаковый STAMP — неудачный ручной запуск сразу после ночного затирал
# готовый дамп. Временное имя уникально, а trap убирает его на любом выходе.
TMP="$(mktemp "$BACKUP_DIR/.db-$STAMP.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

if ! docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$TMP"; then
  echo "$(date '+%F %T') ОШИБКА: pg_dump не отработал — бэкапа за этот прогон нет" >&2
  exit 1
fi

# Дамп мог завершиться успешно, но оказаться пустым — это тоже не бэкап.
SIZE="$(stat -c %s "$TMP")"
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  echo "$(date '+%F %T') ОШИБКА: дамп пустой ($SIZE Б) — бэкапа за этот прогон нет" >&2
  exit 1
fi

mv "$TMP" "$OUT"
trap - EXIT

# Ротация: удаляем дампы старше KEEP_DAYS
find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup ok → $OUT ($(du -h "$OUT" | cut -f1))"
