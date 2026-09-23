#!/bin/sh
# HONA Core 2.0 — роли PostgreSQL (§14.6, §23.7).
#
# Роли — объекты уровня кластера, поэтому они не в миграциях. Скрипт идемпотентен:
#   hona_migrate  — владелец базы, DDL, только для миграций;
#   hona_app      — DML приложения, без DDL (права на таблицы выдают миграции);
#   hona_readonly — только чтение, для диагностики.
#
# Запуск:
#   • dev: автоматически, как /docker-entrypoint-initdb.d/01-roles.sh при первом
#     создании тома postgres в docker-compose.dev.yml;
#   • CI: psql раннера против service container (PGHOST/PGPORT/PGPASSWORD в env);
#   • production: по runbook Phase 23.
#
# Пароли приходят из переменных окружения контейнера и передаются в psql как
# переменные (:'var'), поэтому экранируются PostgreSQL, а не shell. Скрипт не
# читает .env и не печатает пароли.
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${HONA_MIGRATE_PASSWORD:?HONA_MIGRATE_PASSWORD is required}"
: "${HONA_APP_PASSWORD:?HONA_APP_PASSWORD is required}"
: "${HONA_READONLY_PASSWORD:?HONA_READONLY_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --no-psqlrc --quiet \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=db_name="$POSTGRES_DB" \
  --set=migrate_pw="$HONA_MIGRATE_PASSWORD" \
  --set=app_pw="$HONA_APP_PASSWORD" \
  --set=readonly_pw="$HONA_READONLY_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I', r) FROM unnest(ARRAY['hona_migrate','hona_app','hona_readonly']) AS r
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec

ALTER ROLE hona_migrate  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'migrate_pw';
ALTER ROLE hona_app      LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_pw';
ALTER ROLE hona_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'readonly_pw';

-- Владелец базы — hona_migrate: он создаёт расширения, схему drizzle и таблицы.
ALTER DATABASE :"db_name" OWNER TO hona_migrate;
-- По умолчанию PUBLIC может подключаться и создавать временные таблицы — убираем.
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO hona_app, hona_readonly;
SQL

echo "hona roles: ok"
