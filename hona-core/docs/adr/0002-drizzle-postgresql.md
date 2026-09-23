# ADR 0002 — Доступ к БД: Drizzle ORM + PostgreSQL, raw SQL разрешён

- **Статус:** принято владельцем 23.09.2026 (решение D-2, Architecture v1.0 Final §0, §3).
- **Реализация:** Phase 1 — `packages/db`.

## Контекст

В v1 вся компания хранилась одним jsonb-документом `board_state`, схема создавалась
`CREATE TABLE IF NOT EXISTS` при старте, миграций не было (§1). Архитектура 2.0 — одна сущность,
одна таблица, составные tenant-FK, ни одного CASCADE (§5).

## Решение

- **Drizzle** — схема на TypeScript (`packages/db/src/schema`), типизированный доступ, CRUD, relations
  и генерация SQL-миграций `drizzle-kit generate`, которые читаются на ревью как обычный SQL.
- **Raw SQL** через тег `sql` — аналитика, CTE, advisory locks, `FOR UPDATE SKIP LOCKED` и горячие
  запросы (пример — захват outbox в `apps/worker/src/outbox/claim.ts`). Непараметризованный SQL
  запрещён ESLint-правилом.
- **PostgreSQL 16 — источник истины.** Абстракций поверх него нет.
- Миграции **forward-only**; ручной SQL (расширения, функции, GRANT) — в той же последовательности
  (R-17). Мигратор: роль `hona_migrate`, `pg_advisory_lock`, `lock_timeout = 5s`.
- Роли: `hona_migrate` (DDL), `hona_app` (DML; `domain_events` — только INSERT/SELECT),
  `hona_readonly`. Роли — объекты кластера, их создаёт `init/01-roles.sh`, не миграции.

## Последствия

- Drift проверяется дважды: DB-тест сравнивает мигрированную базу со схемой Drizzle, CI job
  `migrations` требует, чтобы `drizzle-kit generate` не порождал новых файлов.
- Один экземпляр `drizzle-orm` на весь workspace (зависимость корня `hona-core`): иначе типы
  транзакции из разных копий пакета несовместимы.
