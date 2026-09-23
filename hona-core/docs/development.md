# HONA Core 2.0 — локальная разработка

Документ для разработчика, который впервые клонировал репозиторий. Каноническая архитектура —
[`architecture/HONA_CORE_2_ARCHITECTURE_V1_FINAL.md`](architecture/HONA_CORE_2_ARCHITECTURE_V1_FINAL.md),
правила работы — [`../CLAUDE.md`](../CLAUDE.md).

## Что здесь и чего здесь нет

- **HONA Core 2.0 живёт только в `hona-core/`.** Легаси v1 (`src/`, `api/`, `shared/`, `deploy/` в корне
  репозитория) заморожен, не собирается этим workspace и не импортируется (ESLint и тест-страж).
- **Phase 1 — только фундамент:** workspace, Fastify API с health/readiness, Drizzle и мигратор,
  `domain_events` + transactional outbox, воркер outbox, оболочка веба с экраном состояния, CI.
  Бизнес-модулей (auth, компании, проекты, доски, задачи…) нет — они появятся в своих фазах (§18).
- **PostgreSQL — источник истины.** Redis и MinIO — инфраструктура; данных-первоисточников в них нет.
- **Старый production-сервер не нужен.** Всё поднимается из Git и локального Docker.
- **Сервисы Docker здесь — dev-инфраструктура**, а не production. Production-compose и Caddy — Phase 23.

## Требования

| Инструмент                | Версия                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Node.js                   | 22 LTS (`.nvmrc`), npm 10                                                             |
| Docker                    | Engine 24+ с Compose v2 (`docker compose`)                                            |
| Свободные порты 127.0.0.1 | 5433 PostgreSQL, 6380 Redis, 9000/9001 MinIO, 3000 API, 3001 health воркера, 5173 web |

Все команды ниже выполняются в каталоге `hona-core/`.

## 1. Окружение

```sh
cp .env.example .env
```

Замените каждое `change-me…` своим значением. Пароли в `DATABASE_URL` / `DATABASE_URL_MIGRATE`
должны совпадать с `HONA_APP_PASSWORD` / `HONA_MIGRATE_PASSWORD`, а в `TEST_DATABASE_ADMIN_URL` —
с `POSTGRES_PASSWORD`. `.env` не коммитится и **никогда не source-ится shell-скриптами**: его читают
`docker compose` и Node (`--env-file`, `process.loadEnvFile`).

| Переменная                                                                                      | Кто читает           | Назначение                                                                                                              |
| ----------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                      | api, worker          | `development` / `test` / `production`. В production дополнительно требуются https и непустые, не-плейсхолдерные секреты |
| `HOST`, `PORT`                                                                                  | api                  | адрес и порт HTTP (по умолчанию `127.0.0.1:3000`)                                                                       |
| `APP_ORIGIN`                                                                                    | api, MinIO CORS      | origin веба; мутации с другим `Origin` → 403                                                                            |
| `LOG_LEVEL`                                                                                     | api, worker          | `fatal`…`trace`, `silent`                                                                                               |
| `TRUST_PROXY`                                                                                   | api                  | `false` / `true` / число хопов / список IP-CIDR                                                                         |
| `DATABASE_URL`                                                                                  | api, worker          | роль `hona_app` (только DML)                                                                                            |
| `DATABASE_URL_MIGRATE`                                                                          | мигратор             | роль `hona_migrate` (DDL)                                                                                               |
| `REDIS_URL`                                                                                     | api                  | Redis (в Phase 1 — только readiness)                                                                                    |
| `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | api                  | MinIO/S3; ключи — пользователь приложения, созданный `minio-init`                                                       |
| `WORKER_ID`, `WORKER_HEALTH_PORT`                                                               | worker               | идентификатор экземпляра (по умолчанию `hostname-pid`), порт `/health` (3001)                                           |
| `POSTGRES_PASSWORD`, `HONA_*_PASSWORD`, `MINIO_ROOT_*`, `MINIO_IMAGE`, `MC_IMAGE`               | docker compose       | только dev-инфраструктура                                                                                               |
| `TEST_DATABASE_ADMIN_URL`                                                                       | интеграционные тесты | суперпользователь dev-кластера: создаёт и удаляет только базы `hona_test_*`                                             |

Неполное или невалидное окружение: процесс не стартует и печатает **имена** переменных без значений.

## 2. Зависимости: PostgreSQL 16, Redis 7, MinIO

```sh
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps        # postgres и redis — healthy, minio-init — Exited (0)
```

- Все порты опубликованы только на `127.0.0.1`.
- При первом создании тома PostgreSQL выполняется `packages/db/init/01-roles.sh`: роли
  `hona_migrate` (владелец базы, DDL), `hona_app` (DML), `hona_readonly` (чтение).
- `minio-init` создаёт приватный bucket `hona` (anonymous `none`) и пользователя приложения
  с доступом только к нему. CORS ограничен `APP_ORIGIN`.
- MinIO больше не публикует образы на Docker Hub; по умолчанию используются закреплённые релизы
  с `quay.io/minio`. Если реестр недоступен, укажите совместимые образы в `.env`
  (`MINIO_IMAGE`, `MC_IMAGE`) — это только dev-инфраструктура.

## 3. Установка и миграции

```sh
npm ci
npm run db:migrate          # под hona_migrate, advisory lock, lock_timeout 5s; повторный запуск ничего не меняет
```

Миграции **forward-only**: применённый файл не редактируется (CI сравнивает с базовой веткой).
Новая миграция: изменить `packages/db/src/schema/*.ts` → `npm run db:generate` → прочитать SQL →
закоммитить. То, что drizzle-kit не выражает (расширения, функции, триггеры, GRANT), — ручной SQL
в той же последовательности (`npx drizzle-kit generate --custom` в `packages/db`). `ON DELETE CASCADE`
запрещён (DB-тест `no-cascade`).

## 4. Запуск api, worker и web

```sh
npm run dev
```

Поднимает три процесса с читаемыми логами (`pino-pretty` в конвейере; сами процессы пишут JSON):

| Процесс | Адрес                                                                        |
| ------- | ---------------------------------------------------------------------------- |
| api     | http://127.0.0.1:3000/api/v1/health, `/api/v1/health/ready`                  |
| worker  | http://127.0.0.1:3001/health (внутренний health)                             |
| web     | http://localhost:5173 — экран «Состояние системы»; `/api` проксируется в API |

Ctrl+C останавливает всё штатно: API дожидается текущих запросов, воркер дорабатывает пачку.
По отдельности: `npm run dev -w @hona/api`, `npm run dev -w @hona/worker`, `npm run dev -w @hona/web`.

Проверка пути событий (приёмка Phase 1): при запущенном воркере

```sh
npm run system:ping         # emit в транзакции → domain_events → outbox → воркер → noop → done
```

## 5. Тесты

```sh
npm run test:unit           # без внешних зависимостей: чистые функции, API через app.inject(), web в jsdom
npm run test:integration    # нужен шаг 2 и .env: настоящий PostgreSQL, Redis, MinIO
npm run test:coverage       # оба проекта + пороги покрытия (core API и outbox воркера ≥ 90 % строк)
```

Интеграционные тесты не трогают dev-базу `hona`: globalSetup создаёт базу-шаблон `hona_test_template`
с миграциями, каждый воркер Vitest получает свою копию `hona_test_w<N>` (`CREATE DATABASE … TEMPLATE`),
между тестами — `TRUNCATE`. Тестовая инфраструктура отказывается работать с любым именем базы,
кроме `hona_test_*`. Нет переменных окружения — тесты падают с понятной ошибкой, а не пропускаются.

## 6. Проверки как в CI

```sh
npm run lint                         # ESLint (границы пакетов, запрет импорта легаси, SQL только параметризованный) + Prettier
npm run typecheck                    # tsc -b по всем workspace, включая тесты
npm run test:unit
npm run test:coverage                # после шага 2
npm run db:generate && git status --porcelain -- packages/db/migrations   # пусто = схема и миграции совпадают
npm run check:migrations -- origin/develop-2.0                            # применённые миграции не изменены
npm run build && npm run check:bundle                                     # сборка и лимит 600 КБ gzip
npm run openapi:check                                                     # docs/api/openapi.json совпадает с контрактами
docker build -f apps/api/Dockerfile .    # аналогично apps/worker, apps/web
npm audit --audit-level=high             # до Phase 22 — предупреждение
```

Секреты (из корня репозитория):

```sh
docker run --rm -v "$PWD:/repo" --entrypoint sh zricethezav/gitleaks:v8.30.1 -c \
  "git config --global --add safe.directory /repo && gitleaks git /repo --log-opts='origin/develop-2.0..HEAD' --redact"
```

Образы api и worker поверх dev-инфраструктуры: `docker compose -f docker-compose.dev.yml --profile app up -d --build`
(api на `127.0.0.1:3100`).

## 7. Если readiness отвечает 503

`/api/v1/health/ready` наружу отдаёт только `{"status":"unavailable"}`. Причина — в логе API,
строка `readiness: dependency unavailable` с полем `checks` (`postgres`, `redis`, `s3`: `ok`, `durationMs`, `error`).

| Проверка   | Частые причины                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres` | контейнер не запущен; пароль в `DATABASE_URL` не совпадает с `HONA_APP_PASSWORD`; том создан до правки паролей (роли создаются только при первом запуске) |
| `redis`    | контейнер не запущен; неверный порт в `REDIS_URL` (dev — 6380)                                                                                            |
| `s3`       | `minio-init` не отработал (`docker compose … logs minio-init`); ключи в `.env` не совпадают с созданным пользователем; bucket называется иначе            |

Liveness (`/api/v1/health`) при этом остаётся 200: процесс жив, недоступна зависимость. После
восстановления зависимости readiness возвращается к 200 без перезапуска API.

## 8. Сброс ТОЛЬКО локальной dev-базы

Команда удаляет тома **этого локального** compose-проекта (`hona-core-dev`): базу, MinIO и роли.

```sh
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
npm run db:migrate
```

Никогда не выполняйте её против чужого или удалённого окружения. Для staging и production
действуют только runbook Phase 23+: бэкап перед миграцией, forward-only, без удаления данных.
