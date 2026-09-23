# HONA Core 2.0

Корпоративная платформа задач IT-HONA, вторая версия. Архитектура утверждена владельцем
23.09.2026: [`docs/architecture/HONA_CORE_2_ARCHITECTURE_V1_FINAL.md`](docs/architecture/HONA_CORE_2_ARCHITECTURE_V1_FINAL.md).
Инженерный контракт для Claude Code — [`CLAUDE.md`](CLAUDE.md).

- Код 2.0 живёт только в этой папке. Легаси v1 остаётся в корне репозитория как справочник и
  не импортируется. Стабильный v1 — ветка `main` и тег `v1-final`; разработка 2.0 — `develop-2.0`.
- Phase 1 (Foundation) — только технический фундамент: бизнес-модулей здесь ещё нет.
- PostgreSQL — источник истины. Старый production-сервер не используется.

## Быстрый старт

```sh
cp .env.example .env                                  # заменить change-me
docker compose -f docker-compose.dev.yml up -d        # PostgreSQL 16, Redis 7, MinIO (только 127.0.0.1)
npm ci
npm run db:migrate
npm run dev                                           # api :3000, worker :3001, web :5173
```

Откройте http://localhost:5173 — экран «Состояние системы» показывает `ok` для API и зависимостей.
Подробности, переменные окружения, тесты и проверки CI — [`docs/development.md`](docs/development.md).

## Структура

```
apps/api       Fastify 5: /api/v1/health, /api/v1/health/ready; core — конфиг, логи, ошибки, контекст, emit()
apps/worker    диспетчер outbox: захват SKIP LOCKED, повторы с backoff, dead-letter, свип, LISTEN/NOTIFY
apps/web       React 18 + Vite 5 + Tailwind 3.4: оболочка и экран состояния, UI-примитивы дизайн-системы
packages/shared  zod-контракты API, коды ошибок, каталог событий
packages/db    Drizzle-схема, миграции (0000_foundation), мигратор, роли БД, тестовая инфраструктура
docs           ADR, development.md, api/openapi.json (генерируется из контрактов)
```

## Команды

| Команда                                                                    | Что делает                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run dev`                                                              | api + worker + web с hot reload                  |
| `npm run build`                                                            | `tsc -b` + `vite build`                          |
| `npm run lint` / `npm run typecheck`                                       | ESLint + Prettier / TypeScript по всем workspace |
| `npm run test:unit` / `npm run test:integration` / `npm run test:coverage` | Vitest                                           |
| `npm run db:generate` / `npm run db:migrate`                               | миграция из схемы / применение миграций          |
| `npm run openapi:generate` / `npm run openapi:check`                       | OpenAPI из zod-контрактов / проверка расхождения |
| `npm run system:ping`                                                      | приёмочное событие через outbox и воркер         |
