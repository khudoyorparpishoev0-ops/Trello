> **HONA Core 2.0 — Architecture v1.0 FINAL**
>
> | Поле | Значение |
> |---|---|
> | Architecture Version | 1.0 Final |
> | Status | APPROVED |
> | Approved | 2026-09-23 |
> | Phase 0 | DONE |
> | Original artifact | https://claude.ai/code/artifact/2f01a22f-7970-4e9b-9826-a3dd08a2e384 (Claude Doc, ревизия 54) |
> | Body SHA-256 | `2453ef70ebc50db5f8482571a96e3b290f151ec17391f8ae5221e6c2997e828b` |
> | Canonical source | этот файл в репозитории; artifact — только reference/mirror |
> | Изменения | только через PR с одобрением владельца и повышением версии |
>
> Тело ниже маркера — выгрузка artifact без правок. Проверка хеша тела:
> `sed '1,/^<!-- END HEADER -->$/d' HONA_CORE_2_ARCHITECTURE_V1_FINAL.md | sha256sum`

<!-- END HEADER -->
# HONA Core 2.0 — Architecture v1.0 Final

Sep 23, 2026 · @Someone

**Архитектура утверждена владельцем 23.09.2026 и является основой дальнейшей разработки.** Phase 0 — Repository Audit & Architecture Freeze: DONE. Решения D-1, D-2, D-3 утверждены, финальная проверка по 16 пунктам пройдена (§20). Phase 1 начинается только по отдельному разрешению, после утверждения Git baseline. Старый сервер отключён; цепочка — Claude Code → GitHub → HONA Core 2.0 → тестирование → новый сервер → staging → production.

## 0. Статус и утверждённые решения

Три решения, блокировавшие Phase 1, утверждены владельцем 23.09.2026. Остальные открытые вопросы (§19.2) нужны не раньше Phase 3.

| # | Решение | Статус | Что это значит для реализации |
| --- | --- | --- | --- |
| D-1 | Backend framework — **Fastify** | APPROVED | Новый API строится модульно на Fastify 5. `api/server.js` на `node:http` дальше не развивается. Полезная domain/business-логика адаптируется (§2). |
| D-2 | Database access — **Drizzle + PostgreSQL, raw SQL разрешён** | APPROVED | Drizzle: схема, типизированный доступ, CRUD, relations, генерация миграций. Raw SQL: аналитика, CTE, отчёты, PostgreSQL-специфика (advisory locks, `SKIP LOCKED`, recursive CTE), горячие запросы. Всегда параметризовано. Никаких абстракций поверх PostgreSQL; PostgreSQL — source of truth. |
| D-3 | Repository — **текущий репозиторий + `develop-2.0`** | APPROVED | Новый репозиторий не создаётся. Весь код 2.0 живёт в изолированной папке `hona-core/` (§4). Легаси не удаляется и не правится; он — справочник для design system, UI, analytics, AI, Telegram и domain logic. `develop-2.0` создаётся в начале Phase 1, не сейчас. |

### Что изменилось относительно Draft

Финальная проверка (§20) нашла в Draft десять реальных дефектов. Все исправлены в соответствующих разделах.

1. **Структура репозитория конфликтовала с легаси.** В корне уже есть `deploy/`, `tests/`, `docs/` и `package.json` v1. 2.0 перенесена в `hona-core/` (§4).
2. **Опасный `ON DELETE CASCADE`** на истории статусов и трудозатратах. Теперь в схеме нет ни одного CASCADE (§6.3, §21).
3. **Задача не могла существовать без доски.** Размещение на доске стало необязательным (§6.1).
4. **Циклы зависимостей не закрывались для параллельных запросов.** Добавлена advisory-блокировка на компанию (§6.3, проверено в §20.2).
5. **Last-write-wins оставался** в `PUT`-замене списков исполнителей, наблюдателей, меток и в переносе без версии. Заменено на коммутативные add/remove и обязательный `If-Match` (§6.5, §9).
6. **Противоречие с legacy import:** `creator_user_id NOT NULL` не совмещался с `origin='migration'`. Исправлено CHECK-ом (§6.1).
7. **Миграции `down`** упоминались, но drizzle-kit их не генерирует. Приняты forward-only миграции (§15, §16).
8. **Presigned-файлы через путь `/s3/*` ломают подпись S3** (подписывается Host). Перенесено на отдельный поддомен и presigned POST с лимитом размера (§12).
9. **Один статус outbox на всех подписчиков:** падение Telegram тянуло бы в dead-letter и realtime. Outbox теперь по строке на пару «событие, обработчик» (§10).
10. **Легаси-аналитику нельзя скопировать «как есть» в Phase 1.** Она зависит от типа всей доски `AppData` и от флага «список выполнен» (`isListDone`). Перенос сдвинут в Phase 12 с новым сборщиком индекса (§4, §18).

Усиления без дефекта в Draft: составные tenant-FK, проверяющие `company_id` на уровне PostgreSQL; глубина подзадач через FK; `task_assignees` переименована в `task_executors`; `responsible_user_id` обязателен (это закрыло вопрос W-2); описаны границы AI и интеграций (§22).

### Предусловия Phase 1 — действия владельца в GitHub

В репозитории нет ветки `main`. Ветка по умолчанию — `claude/kanban-platform-prototype-0y8wef`; в неё уже влит PR #1. В рабочей ветке `claude/platform-structure-design-4j6zoj` есть три не влитых коммита v1 от 14.09.2026: общий код фронтенда и сервера, единое сравнение доски с журналом событий и домен в инструкции. Это не архитектурный блокер, но до создания `develop-2.0` нужно:

1. Влить эти три коммита в ветку по умолчанию одним PR, чтобы стабильная ветка содержала финальный v1. Если они не нужны — явно сказать, что справочником считается коммит `25f9125`.
2. Переименовать ветку по умолчанию в `main` (GitHub → Settings → Branches; старые ссылки и PR перенаправляются). Все правила §16 написаны для `main`.
3. Поставить тег `v1-final` на этот коммит и включить защиту `main` (PR only, без force push).

Пока это не сделано, `develop-2.0` создаётся от коммита `25f9125`. Сама Phase 1 легаси-код не меняет, поэтому выбор базы на неё не влияет.

## 1. Repository Audit

Аудит сделан по коду 20.09.2026. Двенадцать ключевых утверждений предыдущих отчётов перепроверены независимыми проверяющими: опровергнутых нет, четыре уточнены.

### Состояние репозитория

|  |  |
| --- | --- |
| Ветка | `claude/platform-structure-design-4j6zoj`, синхронна с origin, working tree чист |
| История | 63 коммита; HEAD `25f9125` от 14.09. Смысловые вехи: регистрация по корпоративной почте (08.08), QA-аудит и редизайн (07.09), версионирование доски R-01, AI-слой (14.09), shared-код и журнал событий (14.09) |
| `main` | PR #1 не смержен; вся работа живёт в одной ветке. Для 2.0 это надо решить до первой фазы (§16) |
| Объём | \~18 200 строк без тестов и сборки: компоненты 7 585, store 1 140, shared 1 840, api 2 118, тесты 3 577 |
| Миграции БД | Отсутствуют. Схема создаётся `CREATE TABLE IF NOT EXISTS` при старте (`api/server.js:71-120`, `api/boardRepo.js:17-39`) |

### Стек по факту

| Слой | Что есть | Замечание |
| --- | --- | --- |
| Frontend | React 18.3, TypeScript strict, Vite 5, Tailwind 3.4, `@dnd-kit`, lucide-react, vite-plugin-pwa | Собственный роутер (`src/lib/route.ts`), без React Router, без библиотеки серверного состояния |
| Backend | Node 20 (образ), чистый `node:http`, `pg`, `ioredis`, `nodemailer`, `@anthropic-ai/sdk` | Весь роутинг — цепочка `if` в одном файле 731 строки; JavaScript без типов |
| Хранение | PostgreSQL 16: `board_state` (один jsonb-документ = вся компания), `users`, `sessions`, `board_history`, `core_events`, `notif_log`, `email_codes` | 19 маршрутов API, из них вся работа с задачами — `GET`/`PUT /api/board` целиком |
| Redis | Контейнер есть | **Используется только для `ping` в `/api/health`** — ни кеша, ни pub/sub, ни очередей |
| MinIO | Контейнер и том есть, переменные прокинуты | **Ни одна строка кода не обращается.** Аватары — data-URL в `users.avatar`; вложения — только метаданные (`id, name, kind, size`), байтов нет нигде |
| Инфра | docker-compose: caddy, frontend (nginx со статикой), api, postgres, redis, minio; Caddy с CSP/HSTS-заголовками | Multi-stage Dockerfile для api с компиляцией `shared/` |
| Аутентификация | scrypt + соль, cookie `sid` HttpOnly/SameSite=Lax/Secure, 30 дней, сессии в БД, rate limit на логин в памяти процесса, регистрация по коду на корпоративную почту | Смена пароля не инвалидирует другие сессии; CSRF — только SameSite |
| RBAC | Одна глобальная роль `observer / member / admin` | На сервере проверяется только удаление проекта и сброс пароля; любой вошедший читает и пишет всю доску |
| Домен | `shared/domain`: типы, `diffBoardState` (12 видов изменений), события с детерминированным `event_key`, дизайн-правила | Статус задачи выводится из списка (флаг или regex по названию) |
| Аналитика | `shared/analytics`: чистые функции над `AnalyticsIndex` — компания, проекты, отделы, сотрудники, просрочки, загрузка, WIP, качество данных | Один источник расчётов для фронта и сервера; есть тест-страж от второй реализации |
| AI | Сервер: `api/ai.js`, `api/aiAgents.js` (агенты, tool-контракты, лимит датасета, rate limit). Фронт: `src/ai` — оркестратор, верификация доказательств, экран брифа | Архитектура «facts → analytics → agents → executive» соблюдена; модель не получает сырой JSON |
| Telegram | `api/telegram.js`: long polling, привязка по коду, уведомления о назначении и сроке, ежедневные напоминания, защита от дублей через `notif_log` | Отправка прямо после COMMIT в том же процессе, без повторов |
| Тесты | unit 122, api 95, db (нужна живая база) 44 проверки, e2e на Playwright 667 строк | `node --test` с alias-хуком; без CI |
| Документация | README, RUNBOOK, PLATFORM\_STRUCTURE, AI\_ARCHITECTURE, EVENT\_MODEL, SECRETS\_ROTATION, SMTP\_ZOHO, 11 файлов QA-аудита | Актуальна на 14.09, противоречий с кодом не найдено |

### Фронтенд — экраны и состояние

Восемь экранов: доска (kanban / timeline / table), дашборд, AI-бриф, компания, календарь, команда, отчёты, профиль. Всё состояние — один `useReducer` в `boardStore.tsx` (889 строк, 30+ действий), автосохранение всей доски через 700 мс после любого изменения. Компоненты получают данные через контекст (`state`, `data`, `actions`) и не знают о сети — это то, что делает их переносимыми.

### Дефекты, подтверждённые кодом

1. **Открытие страницы пишет доску.** Начальная загрузка (`boardStore.tsx:702-737`) не ставит `skipSaveRef`, `migrate()` всегда возвращает новый объект → PUT на каждую вкладку.
2. **Seed-fallback затирает доску.** При `null` от `loadBoard()` (любой не-2xx) клиент шлёт демо-состояние без версии, сервер принимает (`:712-713`, `boardGuard.js:83`).
3. **Статус = свойство списка.** Переименование колонки в «Готово» закрывает все её задачи (`design.ts:15,24`).
4. **Код задачи придумывает браузер** (`nextTaskCode = max+1` по своей копии) — два одновременных создания дают один номер.
5. **Версия растёт на байт-идентичное тело**; ложные 409 у других вкладок.
6. **`board_state` не масштабируется** ни по правам (нельзя отдать часть), ни по конкурентности (одна блокировка на компанию), ни по истории.

Дефекты 1, 2, 5 — следствие дефекта 6. В 2.0 они не чинятся — они исчезают вместе с моделью «один документ».

### Что изменилось с отключением старого сервера

Всё, что было только на нём, сейчас недоступно: данные `board_state`, бэкапы (лежали там же), `.env` с секретами. Следствие для архитектуры: стратегия «эволюция с адаптером и parity» из предыдущего документа потеряла свой главный довод (сохранить живой production). Секреты — ключ Anthropic, токен Telegram-бота, SMTP-пароль Zoho — придётся перевыпустить (§19).

## 2. Classification

Критерий один: зависит ли модуль от модели «один jsonb-документ = вся компания». Что не зависит — остаётся. Что зависит только через типы — адаптируется. Что построено вокруг документа — строится заново.

### KEEP — берём как есть

| Модуль | Почему |
| --- | --- |
| `shared/analytics/*` (942 строки) | Чистые функции над `AnalyticsIndex`; не знают, откуда пришли данные. Меняется только сборщик индекса. Самый ценный актив репозитория |
| `api/aiAgents.js`, `api/ai.js`, `src/ai/*` | Архитектура слоёв, контракты агентов, верификация доказательств, лимит датасета — всё правильно. Потребуется только перевод на TypeScript и permission-scope на входе |
| `shared/domain/design.ts`, `src/lib/design.ts`, `tailwind.config.ts`, `src/components/ui/*` | Дизайн-система по брендбуку: токены, радиусы, базовые компоненты. Не зависят от данных |
| Аутентификация: scrypt, cookie-сессии в БД, регистрация по коду на корпоративную почту, `verifyCodes.js`, `emailDomains.js`, `rateLimit.js`, `mailer.js` | Решения верные и проверены тестами. JWT не нужен. Добавляется сверху (§14), не переписывается |
| `shared/domain/events.ts`: `stableJson`, `fingerprint`, `eventKey` | Детерминированный ключ события — основа идемпотентности outbox |
| `deploy/Caddyfile` (CSP, HSTS, заголовки), `deploy/backup.sh` | Правильные и проверенные в бою |
| Тестовая дисциплина: `sharedAnalytics.test.ts` (страж от второй реализации), `guards.test.ts`, e2e-харнесс | Приёмы переносятся; конкретные тесты — в ADAPT |
| `docs/AI_ARCHITECTURE.md`, `docs/SECRETS_ROTATION.md`, `docs/SMTP_ZOHO.md` | Актуальны вне зависимости от модели данных |

### ADAPT — сохраняем после адаптации

| Модуль | Что меняется | Почему не REBUILD |
| --- | --- | --- |
| Экраны `src/components/*` (7 585 строк) | Источник данных: вместо `useBoard()` — хуки над API v2 (`useTask`, `useBoardColumns`…). Разметка, стили, drag-and-drop, модальные окна остаются | Компоненты не знают о сети и формате хранения; меняется один слой под ними |
| `shared/domain/types.ts` | Становится пакетом контрактов API: zod-схемы, из них выводятся TS-типы. `Card` → `Task` с полями §6 | Имена и смысл полей сохраняются — это что держит компоненты в ADAPT |
| `src/lib/api.ts` | Становится типизированным клиентом API v2 поверх TanStack Query | Обработка 401/409/сети уже продумана |
| `api/telegram.js` | Источник — outbox, а не `BoardChangeSet`; команды `/today`, `/mytasks`, `/overdue`; привязка аккаунтов, шаблоны сообщений, `notif_log` остаются | Половина работы (привязка, дедупликация, расписание) уже сделана |
| `src/store/auth.tsx`, `router.tsx`, `theme.tsx`, `now.tsx`, `src/lib/route.ts` | Новые разделы навигации (My Day, Inbox, Projects…); тема и время — как есть | Небольшие и независимые |
| `src/lib/filterCards.ts`, `utils.ts` (`taskCode`, `checklistProgress`, `dueStatus`) | Сигнатуры под `Task`; генерация кода уезжает на сервер | Логика отображения верна |
| `docker-compose.yml`, `api/Dockerfile`, `Dockerfile` | Новый сервис `worker`, TypeScript-сборка api, healthchecks | Топология верная |
| `deploy/RUNBOOK.md` | Новый сервер, staging, бэкапы вне сервера | Пошаговая структура хороша |
| Тесты `tests/unit/analytics`, `ai`, `logic`, `route`; `tests/api/*`; e2e | Фикстуры под новую модель; e2e — под новую навигацию | Сценарии остаются актуальными |
| `docs/PLATFORM_STRUCTURE.md`, `docs/ai/EVENT_MODEL.md` | Обновляются под 2.0 | Формат и глубина правильные |

### REBUILD — строим заново

| Модуль | Почему нельзя адаптировать |
| --- | --- |
| `api/server.js` (роутинг, `ensureSchema`, обработчики) | Цепочка `if` без валидации схем, без слоя авторизации, без типов. С сотней маршрутов v2 и RBAC на каждом — неподдерживаемо. Аутентификация из него выносится в модуль (KEEP), остальное — заново |
| `src/store/boardStore.tsx` | Весь смысл файла — держать всю компанию в памяти и сохранять целиком. В 2.0 состояние сервера живёт в кеше запросов, мутации — точечные |
| Схема БД: `board_state`, `board_history` | Корень всех ограничений §1. Заменяется реляционной моделью §5 и миграциями |
| RBAC | Сейчас одна роль и две проверки. Строится по §8 с нуля |
| `src/data/seed.ts` как источник начального состояния | Переезжает в серверный seed для dev/staging; клиент никогда не придумывает данные |
| Генерация кода задачи (`nextTaskCode`, `backfillTaskCodes`) | Код выдаёт сервер атомарно по компании (§6) |

### REMOVE LATER — legacy, удаляется после перехода

| Модуль | Когда | Почему не сейчас |
| --- | --- | --- |
| `shared/domain/diff.ts` + `changeSetToEvents` | После Phase 6 (Task Core), когда события издают сервисы | Живые unit-тесты документируют семантику событий — полезны как спецификация при переносе |
| `api/boardRepo.js`, `api/boardGuard.js` | Вместе с `board_state` | Шаблон транзакции «данные + события до COMMIT» переносится в новые репозитории |
| `src/types.ts`, `src/lib/design.ts`, `src/analytics/index.ts` (re-export слои) | При переходе на workspaces | Сейчас держат импорты компонентов |
| `docs/qa-audit/*` (11 файлов) | После Phase 22 | Исторический контекст решений; часть чек-листов берётся в §15 |
| `api/reset-password.js`, `api/send-test-mail.js` | Когда появятся админ-экраны | Рабочие CLI-инструменты оператора |
| `src/components/board/StickerMenu.tsx`, `BoardBackgroundModal.tsx`, `src/lib/backgrounds.ts` | Решение владельца (§19) | Декоративные функции без бизнес-смысла; перенос стоит времени |

### Итог в цифрах

Примерно 40 % кода — KEEP, 45 % — ADAPT, 15 % — REBUILD. Самый большой риск не в REBUILD (там объём небольшой), а в ADAPT экранов: 7 585 строк компонентов надо перевести с контекста одной доски на хуки над API, экран за экраном, не ломая внешний вид.

## 3. Target Stack

Принцип выбора: менять только то, что мешает, и не добавлять технологию без задачи, которую она решает прямо сейчас. Команда маленькая — каждая лишняя зависимость стоит дороже, чем кажется.

| Слой | Выбор | Почему | Альтернатива и почему нет |
| --- | --- | --- | --- |
| Язык | **TypeScript strict везде**, включая backend | Сейчас api — JavaScript без типов, а shared — TS с компиляцией в api. С RBAC и сотней маршрутов отсутствие типов на сервере — прямой путь к утечкам | — |
| Runtime | **Node 22 LTS** | Текущий образ — Node 20; 22 — актуальный LTS, в sandbox уже 22. Нативный `--experimental-strip-types` уже используется в тестах | Node 20 — выходит из поддержки в апреле 2026 |
| Backend framework | **Fastify 5** | Схемы запросов/ответов валидируются на входе, плагины для cookie, websocket, multipart, rate-limit, OpenAPI — всё что сейчас написано вручную. Быстрый, без магии | Чистый `node:http` (как сейчас) — не тянет сотню маршрутов с валидацией. NestJS — слишком много каркаса для одного разработчика |
| Валидация и контракты | **zod** в `packages/shared`, одни схемы для сервера и клиента | Одно определение `Task` → тип TS, валидатор запроса, OpenAPI. Расхождение фронта и бэка становится ошибкой компиляции | TypeBox — быстрее на сервере, но менее удобен в формах фронта |
| БД | **PostgreSQL 16** (в будущем 17) | Уже есть, команда знает | — |
| Доступ к БД | **Drizzle ORM** + `pg` | Схема в TypeScript, типизированные запросы, автогенерация SQL-миграций, которые читаются как обычный SQL. Не прячет SQL: `sql\`…\`\` доступен везде | Чистый `pg` + свой запускатель миграций (предыдущая рекомендация) — был правилен для эволюции существующей схемы; для 40 новых таблиц с нуля типизация окупается. Prisma — свой движок и свой язык схемы, тяжелее |
| Идентификаторы | **UUID v7**, генерация в приложении, тип `uuid` в БД | Упорядочены по времени → индексы не фрагментируются; не выдают число записей | UUID v4 — случайный порядок в B-tree. `bigserial` — перечислим снаружи |
| Frontend | **React 18 + Vite + Tailwind + @dnd-kit + lucide** — без изменений | Работает, соответствует брендбуку, компоненты переносимы | React 19 — позже, отдельным шагом |
| Состояние сервера на клиенте | **TanStack Query 5** | Кеш по ресурсам, инвалидация по событиям WebSocket, оптимистичные мутации — ровно то, что заменяет `boardStore` | Redux/Zustand — это клиентское состояние, а не серверное; задача другая |
| Маршрутизация клиента | **React Router 6** | Собственный роутер на восемь экранов был оправдан; на двенадцать разделов с вложенными маршрутами и защитой по ролям — нет | Оставить `src/lib/route.ts` — переписывать библиотеку заново |
| Формы | **react-hook-form + zod** | Те же схемы, что на сервере | — |
| Realtime | **WebSocket** (`@fastify/websocket`) + **Redis pub/sub** | См. §11 | SSE — однонаправленный, лимит соединений HTTP/1.1 |
| Фоновые задачи | **Отдельный процесс `worker`** в том же пакете: outbox-диспетчер, напоминания, recurring, Telegram polling | Очередь — таблица `outbox` в PostgreSQL (транзакционная гарантия), Redis — только для pub/sub и блокировок | BullMQ — вторая очередь без транзакций с БД; добавить позже, если понадобятся тяжёлые задачи |
| Файлы | **MinIO** (S3 API) через `@aws-sdk/client-s3` | Контейнер уже есть; переезд на любой S3 — смена endpoint | Файлы на диске — не масштабируется, бэкап неполный |
| Пароли | **scrypt** (`node:crypto`) — без изменений | Встроен, без зависимостей, достаточно стойкий | argon2id — лучше, но нативная зависимость и сборка в alpine |
| TOTP | **otplib** | Стандарт, совместим с Google Authenticator | — |
| AI | **Anthropic SDK** — без изменений | Слой уже построен | — |
| Тесты | **Vitest** (unit, shared, frontend), **node:test** для api с живым PostgreSQL в CI, **Playwright** e2e | Vitest понимает TS и алиасы без собственного хука-резолвера (`tests/alias-hook.mjs` уходит) | — |
| Пакеты | **npm workspaces** | Уже npm; workspaces закрывают проблему «shared компилируется в api/shared» | pnpm — быстрее, но смена инструмента ради скорости — не сейчас |
| Инфра | **Docker Compose, Caddy, PostgreSQL, Redis, MinIO** — без изменений + `worker` | См. §17 | Kubernetes — нет задачи |
| CI | **GitHub Actions** | См. §16 | — |

**D-1 Fastify и D-2 Drizzle + PostgreSQL утверждены 23.09.2026 (§0).** Граница для D-2: Drizzle — схема, миграции, CRUD и relations; raw SQL через тег `sql` — аналитика, recursive CTE, advisory locks, `FOR UPDATE SKIP LOCKED` и любой запрос, где ORM мешает. Непараметризованный SQL запрещён в обоих случаях.

## 4. Repository Architecture

Монорепозиторий на npm workspaces в **изолированной папке `hona-core/`** со своим `package.json`, lockfile, tsconfig и ESLint. Корень репозитория остаётся легаси v1 и не меняется. Причина проверена по коду: в корне уже есть `deploy/`, `tests/`, `docs/` и `package.json` v1, а скрипт `lint` легаси запускает `eslint .` по всему дереву. Старая схема «`shared/` компилируется в `api/shared/`» с алиасом `#shared` в 2.0 не повторяется: пакеты связываются через workspaces.

```
Trello/                              корень репозитория
├─ src/ api/ shared/ tests/ docs/     легаси v1 — справочник, без изменений
├─ deploy/ public/ index.html        легаси v1 — без изменений
├─ package.json vite.config.ts …      легаси v1 — без изменений
├─ .eslintignore                      НОВЫЙ: «hona-core/», чтобы `eslint .` легаси не линтил 2.0
├─ .github/
│  ├─ workflows/hona-core-ci.yml      НОВЫЙ: CI только для hona-core/**
│  └─ dependabot.yml                  НОВЫЙ: только /hona-core, target develop-2.0
└─ hona-core/                         HONA Core 2.0
   ├─ package.json  package-lock.json  tsconfig.base.json  eslint.config.js  vitest.workspace.ts
   ├─ apps/
   │  ├─ web/                         React + Vite; ADAPT-компоненты копируются из src/ по фазам
   │  │  └─ src/
   │  │     ├─ app/                   роутер, провайдеры, оболочка
   │  │     ├─ features/              my-day/ tasks/ boards/ projects/ team/ reports/ ai/ admin/
   │  │     ├─ components/ui/         дизайн-система (KEEP)
   │  │     ├─ api/                   типизированный клиент + TanStack Query хуки
   │  │     └─ realtime/              WebSocket-клиент, инвалидация кеша
   │  ├─ api/                         Fastify 5; HTTP + WebSocket
   │  │  └─ src/
   │  │     ├─ modules/               auth/ company/ projects/ boards/ tasks/ comments/ files/
   │  │     │                         workflow/ notifications/ ai/ telegram/ admin/ health/
   │  │     │                         каждый: routes.ts  service.ts  repo.ts  mappers.ts  *.test.ts
   │  │     ├─ core/                  config/ logger/ errors/ context/ db/ tx/ authz/ events/
   │  │     ├─ app.ts                 buildApp() — фабрика для тестов и сервера
   │  │     └─ server.ts              запуск, graceful shutdown
   │  └─ worker/                      outbox-диспетчер, напоминания, recurring, telegram
   ├─ packages/
   │  ├─ shared/                      zod-контракты API, события, коды ошибок, роли, права — без React и pg
   │  ├─ db/                          drizzle-схема, migrations/, migrate.ts, seed/, init/ (роли БД), tests/
   │  └─ analytics/                   легаси shared/analytics (KEEP, с Phase 12) — чистые функции
   ├─ deploy/                        compose dev → prod, Caddyfile, RUNBOOK, backup (prod — с Phase 23)
   ├─ tests/e2e/                     Playwright (с Phase 6)
   └─ docs/                          ADR, development, api/openapi.json
```

### Правила зависимостей

Стрелка — «может импортировать». Нарушение ловится ESLint-правилом `import/no-restricted-paths` в CI.

```
apps/web         → packages/shared, packages/analytics          (никогда packages/db)
apps/api         → packages/shared, packages/analytics, packages/db
apps/worker      → packages/shared, packages/analytics, packages/db
packages/db      → packages/shared
packages/analytics → packages/shared
packages/shared  → ничего из репозитория
hona-core/**     → ничего из легаси (src/, api/, shared/) — только копии внутри hona-core/
```

Внутри `apps/api/src/modules/*`: `routes → service → repo`. Маршрут не трогает базу, репозиторий не знает о HTTP, сервис не знает ни о том, ни о другом. Модули общаются через сервисы, не через репозитории друг друга.

### Три неизменных правила

1. **Все расчёты — в `packages/analytics`.** Ни SQL-агрегатов по `status` в модулях, ни подсчётов в компонентах. Тест-страж из `sharedAnalytics.test.ts` переносится и расширяется.
2. **Ни один репозиторий не возвращает данные без `scope`** — первый параметр каждого метода, см. §8.
3. **События пишутся только через `core/events`** в той же транзакции, что и данные. Прямой вызов Telegram или почты из сервиса — нарушение.

### Переезд без большого взрыва

Phase 1 создаёт каркас в `hona-core/` и копирует только то, что не зависит от легаси-типов: дизайн-токены Tailwind и базовые UI-примитивы. **`analytics` переносится в Phase 12**, когда появятся данные задач: легаси-модуль зависит от `AppData` и флага `isListDone`. Функции над `AnalyticsIndex` переносятся без изменения логики, сборщик индекса пишется заново по таблицам, «выполнено» определяется категорией статуса DONE. Оригиналы в `src/`, `api/`, `shared/` не перемещаются и не удаляются. Импорт из легаси в 2.0 запрещён правилом ESLint. В CI устанавливаются только зависимости `hona-core/`: иначе Node находит пакет в корневом `node_modules` легаси, и недостающая зависимость не видна локально. `hona-core/` — постоянное место 2.0. Удаление легаси из рабочей линии — отдельное решение владельца в Phase 22; история остаётся в теге `v1-final`.

## 5. Domain Model & PostgreSQL ER

Принцип: **одна сущность — одна таблица**. Никакого `board_state.data` jsonb. JSONB допускается только в трёх местах: `notification_preferences.channels` (маленький конфиг), `audit_log.details` (неструктурированный контекст) и `domain_events.payload` (снимок данных события). Всё остальное — реляционные колонки с FK и CHECK.

### 5.1. Иерархия

```
Company
 └─ Department (дерево: parent_department_id)
     └─ Project / Object (department_id nullable — кросс-департаментные проекты)
         └─ Board (у проекта ≥ 1 доска; Project ≠ Board)
             └─ Column (визуальная позиция; Column ≠ Workflow Status)
                 └─ Task
                     └─ Task (subtask: parent_task_id)
```

**Ключевые решения:**

- Все PK — `uuid` v7, генерируется на сервере. Сортируемые и не раскрывают счётчики.
- Все tenant-таблицы несут `company_id`. Проверяет его **сам PostgreSQL**: у родительских таблиц `UNIQUE (company_id, id)`, у дочерних — составной FK `(company_id, parent_id)`. Задачу компании A нельзя привязать к проекту компании B даже при ошибке в коде (проверено, §20.2).
- Структурная согласованность тоже на FK: доска задачи ∈ её проект, колонка ∈ доска, подзадача ∈ проект родителя, участник проекта ∈ члены компании.
- **Ни одного `ON DELETE CASCADE`.** Политика FK по умолчанию — `NO ACTION` (запрет удаления родителя с детьми). Физическое удаление — только явными admin-процедурами (§21). DB-тест проверяет, что в `pg_constraint` нет FK с `confdeltype = 'c'`.
- `created_at`/`updated_at` — `timestamptz NOT NULL DEFAULT now()`, `updated_at` — триггером. Каждая изменяемая сущность несёт `version integer` для optimistic concurrency (§6.5).
- Архив вместо удаления: `archived_at` у департаментов, проектов, досок, задач; `deleted_at` у комментариев и файлов; пользователи деактивируются. Жизненный цикл каждой сущности — §21.
- Время — только `timestamptz`. Зона хранится у компании и у пользователя.

### 5.2. Таблицы (сгруппированно)

| Группа | Таблицы | Фаза |
| --- | --- | --- |
| Tenant & люди | `companies`, `departments`, `users`, `company_members`, `department_members` | 2–3 |
| Auth & security | `sessions`, `login_history`, `password_resets`, `email_verifications`, `audit_log`; позже `totp_secrets`, `recovery_codes` | 2, 19 |
| Структура работы | `projects`, `project_members`, `boards`, `columns`, `workflows`, `workflow_statuses`, `workflow_transitions` | 4–5, 8 |
| Задачи | `tasks`, `task_executors`, `task_watchers`, `labels`, `task_labels`, `checklists`, `checklist_items`, `task_dependencies`, `task_status_history`, `task_time_entries`, `company_task_counters` | 6–8, 13 |
| Коммуникация | `comments`, `comment_revisions`, `comment_mentions`, `files`, `file_links` | 9–10 |
| Уведомления | `notifications`, `notification_preferences`, `telegram_links`, `telegram_deliveries`, `email_deliveries` | 14–15 |
| События и надёжность | `domain_events`, `outbox`, `outbox_dead_letter`, `idempotency_keys` | 1, 6 |
| Шаблоны | `task_templates`, `recurring_rules`, `automations` | 16 |
| Интеграции | `api_tokens`, `webhook_subscriptions` | 20 |

Из Draft убраны `board_members` (доска наследует права проекта, §8) и `login_attempts` (счётчики попыток — в Redis, факты входа — в `login_history`). `task_assignees` переименована в `task_executors`.

### 5.3. Ядро схемы (DDL-эскиз)

Показаны только колонки, влияющие на архитектуру. Полный DDL появится в Phase 1 как Drizzle-схема + сгенерированные миграции.

```sql
CREATE TABLE companies (
  id                   uuid PRIMARY KEY,
  name                 text NOT NULL,
  slug                 text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  timezone             text NOT NULL DEFAULT 'Asia/Dushanbe',
  task_prefix          text NOT NULL DEFAULT 'TASK' CHECK (task_prefix ~ '^[A-Z][A-Z0-9]{1,9}$'),
  storage_quota_bytes  bigint NOT NULL DEFAULT 21474836480,          -- 20 ГБ
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (                       -- не удаляются, только деактивируются (§21)
  id                   uuid PRIMARY KEY,
  email                citext NOT NULL UNIQUE,
  password_hash        text NOT NULL,                                -- scrypt, §14
  full_name            text NOT NULL,
  timezone             text,
  locale               text NOT NULL DEFAULT 'ru',
  is_active            boolean NOT NULL DEFAULT true,
  deactivated_at       timestamptz,
  password_changed_at  timestamptz NOT NULL DEFAULT now(),
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_members (             -- роль задаётся на уровне компании
  company_id  uuid NOT NULL REFERENCES companies(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('SUPER_ADMIN','DIRECTOR','DEPARTMENT_HEAD',
              'PROJECT_MANAGER','EMPLOYEE','OBSERVER','GUEST')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,                  -- членство закрывается, строка остаётся
  version     integer NOT NULL DEFAULT 1,
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE departments (                 -- дерево; циклы — как у зависимостей (§6.3)
  id                    uuid PRIMARY KEY,
  company_id            uuid NOT NULL REFERENCES companies(id),
  parent_department_id  uuid,
  name                  text NOT NULL,
  position              integer NOT NULL DEFAULT 0,
  version               integer NOT NULL DEFAULT 1,
  archived_at           timestamptz,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, parent_department_id) REFERENCES departments (company_id, id)
);

CREATE TABLE department_members (          -- руководитель = is_head, ровно один
  company_id     uuid NOT NULL,
  department_id  uuid NOT NULL,
  user_id        uuid NOT NULL,
  is_head        boolean NOT NULL DEFAULT false,
  PRIMARY KEY (department_id, user_id),
  FOREIGN KEY (company_id, department_id) REFERENCES departments (company_id, id),
  FOREIGN KEY (company_id, user_id)       REFERENCES company_members (company_id, user_id)
);
CREATE UNIQUE INDEX department_one_head ON department_members (department_id) WHERE is_head;

CREATE TABLE workflows (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id),
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  UNIQUE (company_id, name)
);

CREATE TABLE workflow_statuses (
  id           uuid PRIMARY KEY,
  company_id   uuid NOT NULL,
  workflow_id  uuid NOT NULL,
  key          text NOT NULL,             -- 'NEW','ACCEPTED',... — стабильный машинный ключ
  name         text NOT NULL,             -- отображаемое имя, редактируемое
  category     text NOT NULL CHECK (category IN ('TODO','IN_PROGRESS','TESTING','BLOCKED','DONE')),
  position     integer NOT NULL,
  is_initial   boolean NOT NULL DEFAULT false,
  is_terminal  boolean NOT NULL DEFAULT false,
  UNIQUE (workflow_id, id),
  UNIQUE (workflow_id, key),
  FOREIGN KEY (company_id, workflow_id) REFERENCES workflows (company_id, id)
);

CREATE TABLE workflow_transitions (
  id                uuid PRIMARY KEY,
  company_id        uuid NOT NULL,
  workflow_id       uuid NOT NULL,
  from_status_id    uuid NOT NULL,
  to_status_id      uuid NOT NULL,
  action_key        text NOT NULL,        -- 'accept','start','send_for_review',...
  allowed_actor     text NOT NULL CHECK (allowed_actor IN ('EXECUTOR','RESPONSIBLE','MANAGER','ANY_EDITOR')),
  requires_comment  boolean NOT NULL DEFAULT false,
  is_enabled        boolean NOT NULL DEFAULT true,
  UNIQUE (workflow_id, from_status_id, action_key),
  FOREIGN KEY (workflow_id, from_status_id) REFERENCES workflow_statuses (workflow_id, id),
  FOREIGN KEY (workflow_id, to_status_id)   REFERENCES workflow_statuses (workflow_id, id)
);

CREATE TABLE projects (                    -- Project ≠ Board
  id             uuid PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES companies(id),
  department_id  uuid,                                    -- NULL = кросс-департаментный
  kind           text NOT NULL DEFAULT 'project' CHECK (kind IN ('project','object')),
  name           text NOT NULL,
  description    text,
  owner_user_id  uuid NOT NULL,
  workflow_id    uuid NOT NULL,
  starts_on      date,
  ends_on        date,
  version        integer NOT NULL DEFAULT 1,
  archived_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, department_id) REFERENCES departments (company_id, id),
  FOREIGN KEY (company_id, owner_user_id) REFERENCES company_members (company_id, user_id),
  FOREIGN KEY (company_id, workflow_id)   REFERENCES workflows (company_id, id)
);

CREATE TABLE project_members (
  company_id  uuid NOT NULL,
  project_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  role        text NOT NULL CHECK (role IN ('MANAGER','MEMBER','OBSERVER')),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (company_id, project_id) REFERENCES projects (company_id, id),
  FOREIGN KEY (company_id, user_id)    REFERENCES company_members (company_id, user_id)
);

CREATE TABLE boards (                      -- у проекта 0..N досок
  id           uuid PRIMARY KEY,
  company_id   uuid NOT NULL,
  project_id   uuid NOT NULL,
  name         text NOT NULL,
  position     integer NOT NULL DEFAULT 0,
  version      integer NOT NULL DEFAULT 1,
  archived_at  timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (project_id, id),
  FOREIGN KEY (company_id, project_id) REFERENCES projects (company_id, id)
);

CREATE TABLE columns (                     -- визуальная позиция; Column ≠ Workflow Status
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL,
  board_id           uuid NOT NULL,
  name               text NOT NULL,
  position           integer NOT NULL,
  wip_limit          integer CHECK (wip_limit IS NULL OR wip_limit > 0),
  maps_to_status_id  uuid REFERENCES workflow_statuses (id),  -- необязательно, §7.4
  version            integer NOT NULL DEFAULT 1,
  UNIQUE (board_id, id),
  UNIQUE (board_id, position) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (company_id, board_id) REFERENCES boards (company_id, id)
);
```

Имена активных департаментов, проектов и досок уникальны через частичные индексы `WHERE archived_at IS NULL`, чтобы архив не блокировал повторное имя. Согласованность `columns.maps_to_status_id` с workflow проекта и «ровно один initial-статус» проверяет сервис workflow с тестами: через FK это выразилось бы только денормализацией.

### 5.4. Индексы, которые обязательны с первого дня

| Индекс | Зачем |
| --- | --- |
| `tasks (company_id, code)` UNIQUE | Код задачи уникален в компании, последний рубеж после счётчика |
| `tasks (board_id, column_id, position) WHERE board_id IS NOT NULL` | Загрузка доски одним range-scan |
| `tasks (project_id, status_id) WHERE archived_at IS NULL` | Таблица, календарь, фильтры проекта без привязки к доске |
| `tasks (company_id, responsible_user_id) WHERE archived_at IS NULL` | «Мои задачи» ответственного |
| `task_executors (user_id, task_id)` | «Мои задачи» исполнителя |
| `tasks (parent_task_id) WHERE parent_task_id IS NOT NULL` | Подзадачи карточки |
| `tasks (company_id, deadline_at) WHERE completed_at IS NULL AND archived_at IS NULL` | Календарь, просрочки, дайджесты |
| `task_dependencies (depends_on_id)` | Обратный обход при проверке циклов |
| `comments (task_id, created_at, id)` | Чат задачи, cursor-пагинация |
| `notifications (user_id, read_at, created_at DESC)` | Inbox |
| `outbox (next_attempt_at) WHERE status = 'pending'` | Воркер |
| `domain_events (company_id, occurred_at)`, `domain_events (entity_type, entity_id, occurred_at)` | История сущности, аудит, аналитика |
| `sessions (user_id)`, `sessions (expires_at)` | Инвалидация, очистка |
| `idempotency_keys (expires_at)` | Очистка ключей старше 24 ч |

### 5.5. Что сознательно НЕ делаем

- **Row Level Security PostgreSQL** — не в v1.0. Изоляция обеспечивается на уровне репозиториев + автоматическими тестами изоляции (§15). RLS остаётся как вариант усиления в Phase 22, если тесты покажут пробелы.
- **Партиционирование** `domain_events`/`audit_log` — не нужно при ожидаемых объёмах (десятки тысяч событий в месяц). Решение пересматривается при > 10 млн строк.
- **Триггеры бизнес-логики** — нет. Только технические триггеры (`updated_at`). Вся логика в application-слое, чтобы быть тестируемой.
- **Материализованные представления для аналитики** — нет в v1.0. `packages/analytics` работает поверх обычных запросов; кэш — Redis с TTL (Phase 17).

### 5.6. Совместимость с v1 архитектурой (Doc v1)

Модель `tasks.origin ('app'|'migration')` и `tasks_creator_required` из Doc v1 §7 сохраняются как есть — они нужны Phase 26 (optional legacy import). Остальные решения Doc v1 (адаптивная миграция `board_state` → таблицы, R0, activity measurement) **сняты**: legacy-сервер отключён, миграция не является требованием.

## 6. Task Model

### 6.1. Таблица `tasks`

```sql
CREATE TABLE tasks (
  id                   uuid PRIMARY KEY,
  company_id           uuid NOT NULL,
  project_id           uuid NOT NULL,                 -- задача принадлежит проекту, не доске
  board_id             uuid,                          -- размещение на доске необязательно,
  column_id            uuid,                          -- три поля задаются или очищаются вместе
  position             numeric(20,10),
  parent_task_id       uuid,                          -- подзадача (§6.7)
  parent_level         smallint CHECK (parent_level = 0),
  level                smallint GENERATED ALWAYS AS
                       (CASE WHEN parent_task_id IS NULL THEN 0 ELSE 1 END) STORED,
  code                 text NOT NULL,                 -- 'TASK-1842'
  code_number          integer NOT NULL,
  title                text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  description          text,                          -- markdown
  status_id            uuid NOT NULL REFERENCES workflow_statuses (id),
  priority             text NOT NULL DEFAULT 'NORMAL'
                       CHECK (priority IN ('LOW','NORMAL','HIGH','CRITICAL')),
  creator_user_id      uuid,                          -- NULL только для origin = 'migration'
  responsible_user_id  uuid,                          -- NULL только для origin = 'migration'
  starts_at            timestamptz,
  deadline_at          timestamptz,
  planned_minutes      integer CHECK (planned_minutes IS NULL OR planned_minutes >= 0),
  origin               text NOT NULL DEFAULT 'app' CHECK (origin IN ('app','migration')),
  version              integer NOT NULL DEFAULT 1,    -- optimistic concurrency, §6.5
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  archived_at          timestamptz,
  archive_reason       text CHECK (archive_reason IN ('manual','parent_archived','project_archived')),
  UNIQUE (company_id, code),
  UNIQUE (company_id, id),
  UNIQUE (project_id, id),
  UNIQUE (id, level),
  CHECK ((board_id IS NULL) = (column_id IS NULL) AND (column_id IS NULL) = (position IS NULL)),
  CHECK ((parent_task_id IS NULL) = (parent_level IS NULL)),
  CHECK (parent_task_id IS NULL OR parent_task_id <> id),
  CHECK ((archived_at IS NULL) = (archive_reason IS NULL)),
  CHECK (starts_at IS NULL OR deadline_at IS NULL OR starts_at <= deadline_at),
  CHECK (origin = 'migration' OR (creator_user_id IS NOT NULL AND responsible_user_id IS NOT NULL)),
  FOREIGN KEY (company_id, project_id)          REFERENCES projects (company_id, id),
  FOREIGN KEY (project_id, board_id)            REFERENCES boards (project_id, id),
  FOREIGN KEY (board_id, column_id)             REFERENCES columns (board_id, id),
  FOREIGN KEY (project_id, parent_task_id)      REFERENCES tasks (project_id, id),
  FOREIGN KEY (parent_task_id, parent_level)    REFERENCES tasks (id, level),
  FOREIGN KEY (company_id, creator_user_id)     REFERENCES company_members (company_id, user_id),
  FOREIGN KEY (company_id, responsible_user_id) REFERENCES company_members (company_id, user_id)
);
```

**Инварианты, которые проверяет application-слой (не БД):**

- **Задача не зависит от UI-представления.** Она принадлежит проекту; размещение на доске необязательно. Задача из Telegram, AI или «Моего дня» существует без доски и видна в таблице, календаре и списках. Kanban, таблица, календарь и Gantt — проекции одних и тех же строк.
- **Согласованность проверяет PostgreSQL:** компания проекта, доска из этого проекта, колонка из этой доски, родитель из этого проекта, люди — члены компании. Статус из workflow проекта проверяет сервис workflow.
- **Четыре роли участников, не смешиваются:**
  - creator — кто создал; неизменяем.
  - responsible — ровно один, принимает работу; при создании по умолчанию = creator. Это закрывает вопрос W-2.
  - executors — 0..N в `task_executors`, делают работу.
  - watchers — 0..N в `task_watchers`, получают уведомления; права на изменение не дают.
  - Один человек может совмещать роли, но хранятся они раздельно.
- **`completed_at` ставит только движок workflow** при входе в статус категории DONE и очищает при reopen. Для `origin = 'migration'` он может остаться NULL: историю не придумываем.
- **PATCH не принимает** `status_id`, `completed_at`, `code`, `creator_user_id`, `project_id`, `version`: zod-схема `.strict()` отвечает 400. Статус меняется только через transition (§7), проект — только отдельной командой переноса вместе с подзадачами одним UPDATE.

### 6.2. Код задачи: `TASK-1842`

Требование: код уникален в компании, монотонный, без дыр в обычном режиме, генерируется на сервере в той же транзакции, что и задача. **Не глобальный sequence** — у каждой компании свой счётчик.

```sql
CREATE TABLE company_task_counters (
  company_id  uuid PRIMARY KEY REFERENCES companies(id),
  last_number integer NOT NULL DEFAULT 0
);

-- Внутри транзакции создания задачи:
UPDATE company_task_counters
   SET last_number = last_number + 1
 WHERE company_id = $1
RETURNING last_number;
```

`UPDATE … RETURNING` берёт row lock на строку счётчика компании, параллельные создания сериализуются на ней. В отличие от sequence, счётчик транзакционный: откат создания откатывает и номер, поэтому дыр нет вообще. Это проверено: 200 параллельных транзакций, из них 8 откачены, дали 192 уникальных кода без пропусков (§20.2). Цена — создание задач внутри одной компании идёт по одной транзакции за раз; при ожидаемых объёмах это незаметно, потому что транзакция создания короткая. `UNIQUE (company_id, code)` — последний рубеж. Строка счётчика создаётся в той же транзакции, что и компания. Код = `task_prefix || '-' || last_number`.

Переименование префикса компании **не** переписывает существующие коды (правило «не менять task codes без решения»).

### 6.3. Связанные таблицы

Все связи — `NO ACTION`, без CASCADE. История статусов, трудозатраты и комментарии не могут исчезнуть вместе с задачей.

```sql
CREATE TABLE task_executors (           -- исполнители: кто делает
  company_id   uuid NOT NULL,
  task_id      uuid NOT NULL,
  user_id      uuid NOT NULL,
  assigned_by  uuid NOT NULL REFERENCES users (id),
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id),
  FOREIGN KEY (company_id, user_id) REFERENCES company_members (company_id, user_id)
);

CREATE TABLE task_watchers (            -- наблюдатели: только уведомления
  company_id  uuid NOT NULL,
  task_id     uuid NOT NULL,
  user_id     uuid NOT NULL,
  added_by    uuid NOT NULL REFERENCES users (id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id),
  FOREIGN KEY (company_id, user_id) REFERENCES company_members (company_id, user_id)
);

CREATE TABLE labels (
  id           uuid PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES companies (id),
  name         text NOT NULL,
  color        text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at  timestamptz,
  UNIQUE (company_id, id),
  UNIQUE (company_id, name)
);

CREATE TABLE task_labels (
  company_id  uuid NOT NULL,
  task_id     uuid NOT NULL,
  label_id    uuid NOT NULL,
  PRIMARY KEY (task_id, label_id),
  FOREIGN KEY (company_id, task_id)  REFERENCES tasks (company_id, id),
  FOREIGN KEY (company_id, label_id) REFERENCES labels (company_id, id)
);

CREATE TABLE checklists (
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL,
  task_id     uuid NOT NULL,
  title       text NOT NULL,
  position    integer NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id)
);

CREATE TABLE checklist_items (
  id            uuid PRIMARY KEY,
  company_id    uuid NOT NULL,
  checklist_id  uuid NOT NULL,
  text          text NOT NULL,
  position      integer NOT NULL,
  done_at       timestamptz,
  done_by       uuid REFERENCES users (id),
  version       integer NOT NULL DEFAULT 1,
  FOREIGN KEY (company_id, checklist_id) REFERENCES checklists (company_id, id)
);

CREATE TABLE task_dependencies (        -- Phase 13
  company_id     uuid NOT NULL,
  task_id        uuid NOT NULL,
  depends_on_id  uuid NOT NULL,
  kind           text NOT NULL DEFAULT 'blocks' CHECK (kind IN ('blocks','relates')),
  created_by     uuid NOT NULL REFERENCES users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id),
  FOREIGN KEY (company_id, task_id)       REFERENCES tasks (company_id, id),
  FOREIGN KEY (company_id, depends_on_id) REFERENCES tasks (company_id, id)
);

CREATE TABLE task_status_history (      -- append-only: каждый переход
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL,
  task_id         uuid NOT NULL,
  from_status_id  uuid REFERENCES workflow_statuses (id),
  to_status_id    uuid NOT NULL REFERENCES workflow_statuses (id),
  action_key      text NOT NULL,
  actor_user_id   uuid NOT NULL REFERENCES users (id),
  comment         text,                   -- обязателен для request_revision
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id)
);

CREATE TABLE task_time_entries (        -- spent time
  id          uuid PRIMARY KEY,
  company_id  uuid NOT NULL,
  task_id     uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES users (id),
  minutes     integer NOT NULL CHECK (minutes > 0),
  spent_on    date NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  FOREIGN KEY (company_id, task_id) REFERENCES tasks (company_id, id)
);

CREATE TABLE comments (                 -- чат задачи (Phase 9)
  id              uuid PRIMARY KEY,
  company_id      uuid NOT NULL,
  task_id         uuid NOT NULL,
  author_user_id  uuid NOT NULL,
  body            text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  edited_at       timestamptz,
  deleted_at      timestamptz,            -- soft delete, §21
  deleted_by      uuid REFERENCES users (id),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, task_id)        REFERENCES tasks (company_id, id),
  FOREIGN KEY (company_id, author_user_id) REFERENCES company_members (company_id, user_id)
);

CREATE TABLE comment_revisions (        -- предыдущие версии текста
  comment_id  uuid NOT NULL REFERENCES comments (id),
  revision    integer NOT NULL,
  body        text NOT NULL,
  edited_by   uuid NOT NULL REFERENCES users (id),
  edited_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, revision)
);

CREATE TABLE comment_mentions (
  company_id  uuid NOT NULL,
  comment_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  FOREIGN KEY (company_id, comment_id) REFERENCES comments (company_id, id),
  FOREIGN KEY (company_id, user_id)    REFERENCES company_members (company_id, user_id)
);
```

**Защита от циклов зависимостей.** Проверка «нет ли пути обратно» без блокировки не защищает от гонки: два параллельных запроса A→B и B→A проходят оба и создают цикл. Это воспроизведено в §20.2. Поэтому добавление зависимости сериализуется advisory-блокировкой на компанию:

```sql
-- в транзакции добавления task → depends_on (READ COMMITTED)
SELECT pg_advisory_xact_lock(hashtextextended('deps:' || $company_id, 0));
WITH RECURSIVE reach(id) AS (
  SELECT depends_on_id FROM task_dependencies WHERE task_id = $depends_on
  UNION
  SELECT d.depends_on_id FROM task_dependencies d JOIN reach r ON d.task_id = r.id
)
SELECT EXISTS (SELECT 1 FROM reach WHERE id = $task) AS creates_cycle;  -- true → 422 DEPENDENCY_CYCLE
INSERT INTO task_dependencies (…) VALUES (…);
```

Тот же приём защищает дерево департаментов при смене `parent_department_id` (ключ `'departments:' || company_id`). Зависимости между проектами одной компании разрешены, если актор видит обе задачи. Зависимость между родителем и его подзадачей запрещена: иерархия уже задаёт порядок (§6.7). Файлы — §12.

### 6.4. Порядок в колонке (`position`)

`numeric(20,10)` с fractional indexing: перенос карточки между двумя соседями = `(prev + next) / 2`, один UPDATE одной строки. Когда разница позиций падает ниже `1e-6`, сервис перенумеровывает колонку шагом 1000 в той же транзакции. Это убирает главный источник конфликтов старой модели, где любое перемещение переписывало всю доску.

### 6.5. Optimistic concurrency на уровне задачи

Last-write-wins всей доски из v1 закрывается тремя правилами.

1. **Версия на сущности.** `version integer` есть у tasks, comments, checklists, checklist\_items, projects, boards, columns, departments, workflows, companies, users, company\_members. Каждое изменение строки делает `version = version + 1`.
2. **Ожидаемая версия обязательна.** Любая мутация строки — `PATCH`, move, transition, archive — несёт `If-Match: "<version>"`. UPDATE идёт как `WHERE id = $1 AND version = $2`. Нет заголовка → `428 PRECONDITION_REQUIRED`. Ноль затронутых строк → `409 VERSION_CONFLICT` с `details: { currentVersion, current: <DTO>, changedBy, changedAt }`.
3. **Наборы меняются коммутативно.** Исполнители, наблюдатели, метки, участники проекта и департамента меняются операциями add/remove одного элемента, а не заменой всего списка. Два человека добавляют разных исполнителей — оба изменения сохраняются без `If-Match`. Повторное добавление идемпотентно (`ON CONFLICT DO NOTHING`).

**Поведение клиента при 409:**

- Оптимистичное изменение откатывается, кэш TanStack Query получает `current` из ответа.
- Если поля, которые менял пользователь, на сервере не менялись, клиент один раз автоматически повторяет запрос с новой версией.
- Если поля пересекаются, показывается диалог «Изменено <кем> в <когда>» с выбором: оставить их версию или применить свою поверх. Второй вариант — новый запрос с актуальным `If-Match`. Текст описания не теряется: черновик остаётся в редакторе.
- Кеш не принимает ответ с `version` ниже уже известной. Это защита от гонки двух refetch после realtime-инвалидации.

Защита от двойного создания (двойной клик, retry при плохой сети) — `Idempotency-Key` (§9.1).

### 6.6. Что НЕ хранится в `tasks`

- Денормализованные счётчики (кол-во комментариев, файлов, закрытых пунктов чеклиста). Считаются запросом; при необходимости кэшируются в Redis (Phase 22).
- Имя колонки/статуса/исполнителя. Только FK.
- Любые «вычисленные» флаги (overdue, stale). Это функции `packages/analytics` над строкой.

### 6.7. Подзадачи

Подзадача — обычная строка `tasks` с `parent_task_id`. У неё свой код, статус, ответственный и исполнители.

| Аспект | Решение | Кто обеспечивает |
| --- | --- | --- |
| Связь с родителем | `parent_task_id`; подзадача в том же проекте, что и родитель | FK `(project_id, parent_task_id)` |
| Глубина | ровно один уровень: родитель всегда корневая задача | FK `(parent_task_id, parent_level)` → `tasks (id, level)`, `parent_level = 0` |
| Циклы | невозможны: задачу с подзадачами нельзя сделать подзадачей, сама себе родителем задача быть не может | тот же FK + CHECK; FK берёт блокировку родителя, поэтому безопасно при параллельных запросах |
| Доска | по умолчанию без размещения, показывается в карточке родителя; можно положить на доску проекта | необязательное размещение, §6.1 |
| Права | видимость — как у проекта; создать подзадачу может тот, кто имеет `task.create` в проекте и `task.edit` на родителе; изменение самой подзадачи — по её собственным ролям | `authorize`, §8 |
| Архив | архив родителя архивирует его активные подзадачи с `archive_reason = 'parent_archived'` в той же транзакции и событием на каждую. Восстановление родителя возвращает только их, вручную архивированные остаются в архиве | сервис tasks |
| Завершение | `complete` родителя с незакрытыми подзадачами → `422 SUBTASKS_OPEN`; правило отключается на уровне проекта | движок workflow, §7.3 |
| Зависимости | подзадача может зависеть от соседней и от любой задачи компании; зависимость «родитель ↔ своя подзадача» запрещена | сервис + advisory lock, §6.3 |
| Перенос в другой проект | родитель и подзадачи переносятся одним UPDATE; поодиночке FK не пропустит | FK `(project_id, parent_task_id)` |

## 7. Workflow

### 7.1. Статусы по умолчанию

У каждой компании при создании появляется workflow «Стандартный» (`is_default = true`). Проект ссылается на один workflow; все задачи проекта живут в нём.

| key | Название (RU) | category | Флаги |
| --- | --- | --- | --- |
| `NEW` | Новая | TODO | initial |
| `ACCEPTED` | Принята | TODO |  |
| `IN_PROGRESS` | В работе | IN\_PROGRESS |  |
| `WAITING` | Ожидание | BLOCKED |  |
| `ON_REVIEW` | На проверке | TESTING |  |
| `NEEDS_REVISION` | На доработку | IN\_PROGRESS |  |
| `COMPLETED` | Выполнена | DONE | ставит `completed_at` |
| `CLOSED` | Закрыта | DONE | terminal |

`category` — фиксированный набор из пяти значений (TODO / IN PROGRESS / TESTING / BLOCKED / DONE). Он нужен, чтобы аналитика, дашборды и «Мой день» работали одинаково для любого кастомного workflow: компания может добавить статус «Согласование с заказчиком», но обязана отнести его к одной из пяти категорий.

### 7.2. Переходы по умолчанию

| Действие (`action_key`) | Из | В | Кто может | Комментарий | Событие |
| --- | --- | --- | --- | --- | --- |
| `accept` | NEW | ACCEPTED | EXECUTOR, RESPONSIBLE | — | `task.accepted` |
| `start` | ACCEPTED, NEEDS\_REVISION | IN\_PROGRESS | EXECUTOR | — | `task.started` |
| `wait` | IN\_PROGRESS | WAITING | EXECUTOR, RESPONSIBLE | обязателен (причина) | `task.blocked` |
| `resume` | WAITING | IN\_PROGRESS | EXECUTOR, RESPONSIBLE | — | `task.started` |
| `send_for_review` | IN\_PROGRESS | ON\_REVIEW | EXECUTOR | — | `task.sent_for_review` |
| `withdraw_review` | ON\_REVIEW | IN\_PROGRESS | EXECUTOR | — | `task.review_withdrawn` |
| `request_revision` | ON\_REVIEW | NEEDS\_REVISION | RESPONSIBLE, MANAGER | обязателен | `task.revision_requested` |
| `complete` | ON\_REVIEW | COMPLETED | RESPONSIBLE, MANAGER | — | `task.completed` |
| `close` | COMPLETED | CLOSED | RESPONSIBLE, MANAGER | — | `task.closed` |
| `reopen` | COMPLETED, CLOSED | IN\_PROGRESS | RESPONSIBLE, MANAGER | обязателен | `task.reopened` |

Любой переход, которого нет в таблице, запрещён. OBSERVER и GUEST не выполняют ни одного перехода вне зависимости от роли в задаче.

Семантика `allowed_actor`:

- **EXECUTOR** — пользователь есть в `task_executors`. Если исполнителей нет, роль EXECUTOR выполняет ответственный.
- **RESPONSIBLE** — `tasks.responsible_user_id`.
- **MANAGER** — `project_members.role = 'MANAGER'`, или руководитель департамента проекта, или DIRECTOR / SUPER\_ADMIN компании (§8).
- **ANY\_EDITOR** — любой, у кого есть `task.edit` на этой задаче. В стандартном workflow не используется, нужен для кастомных.

SUPER\_ADMIN и DIRECTOR проходят как MANAGER на любой задаче компании. Это единственный «обход», и он попадает в `task_status_history` с реальным `actor_user_id`.

**Frontend не меняет статус сам.** Путей смены статуса два, и оба идут через один серверный движок: `POST /tasks/:id/transition { action, comment? }` с `If-Match` и перенос карточки в колонку с `maps_to_status_id` (§7.4). `PATCH /tasks/:id` поле статуса не принимает. Кнопки действий строятся из поля `allowedActions[]` в ответе `GET /tasks/:id`. Сервер вычисляет его тем же движком; клиентская логика — только отображение.

### 7.3. Движок переходов (`apps/api/src/modules/workflow`)

Единственная точка смены статуса — `transitionTask(ctx, taskId, actionKey, { comment? })`. Внутри одной транзакции:

1. `SELECT … FOR UPDATE` задачи и сверка с `If-Match`. Версия не совпала → `409 VERSION_CONFLICT`: клиент действовал по устаревшему статусу.
2. `task.view` не проходит → `404`. OBSERVER / GUEST → `403`.
3. Поиск перехода в `workflow_transitions` по workflow проекта, текущему статусу и `action_key`, только `is_enabled`. Нет → `422 TRANSITION_NOT_ALLOWED`.
4. Проверка `allowed_actor` (§8). Не прошла → `403 TRANSITION_FORBIDDEN`.
5. Предусловия: `requires_comment` без комментария → `422 COMMENT_REQUIRED`; `complete` при незакрытых подзадачах → `422 SUBTASKS_OPEN`. Влияние незавершённых блокирующих зависимостей на `start` определяет Phase 13; по умолчанию это предупреждение в ответе.
6. UPDATE `status_id`, `version + 1`. Вход в категорию DONE при `completed_at IS NULL` → `completed_at = now()`; выход из DONE → `completed_at = NULL`.
7. Если задача размещена на доске и на этой доске есть колонка с `maps_to_status_id` = новый статус, карточка переносится в конец этой колонки. Иначе остаётся на месте.
8. INSERT в `task_status_history` с `action_key` и комментарием.
9. `emit(<событие из таблицы>)` → `domain_events` + `outbox` (§10). Шаги 1–9 — одна транзакция.

### 7.4. Связь колонка ↔ статус

Перенос карточки drag-and-drop в колонку с `maps_to_status_id`:

- Сервер ищет переход `from = текущий статус`, `to = статус колонки`. Найден и актор допустим — выполняется переход + перенос.
- Не найден — `422 TRANSITION_NOT_ALLOWED`, карточка остаётся на месте, фронт показывает причину. Никакого «тихого» переноса без смены статуса.

Перенос в колонку **без** `maps_to_status_id` — чисто визуальный, статус не меняется. Это закрывает дефект v1, где статус выводился из флага списка и regex по заголовку.

### 7.5. Настраиваемость

В v1.0 администратор компании может: переименовать статусы, добавить статус с категорией, включить/выключить переход, сменить `allowed_actor`. Нельзя: удалить статус, на котором есть задачи; оставить workflow без initial или без DONE-статуса; сменить workflow проекта без маппинга статусов (Phase 16).

### 7.6. Открытые вопросы владельцу

- **W-1.** Нужен ли статус `ACCEPTED` как отдельный шаг, или принятие равно началу работы? По умолчанию — отдельный, как в ТЗ. Нужен до Phase 8, на схему не влияет: это данные workflow, а не код.
- **W-2 закрыт.** Ответственный теперь есть у каждой задачи (по умолчанию — создатель), поэтому вопрос «кто закрывает задачу без ответственного» больше не возникает. Когда исполнитель и ответственный — один человек, он сам принимает работу. Запрет самоприёмки можно включить настройкой проекта в Phase 8.

## 8. RBAC

### 8.1. Модель

Роль назначается на уровне компании (`company_members.role`), уточняется членством в департаменте (`department_members`) и проекте (`project_members.role`). Права не хранятся в БД — они заданы кодом в `packages/shared/src/rbac/permissions.ts` и вычисляются чистой функцией:

```ts
can(actor: Actor, permission: Permission, scope: Scope): boolean

// Actor = { userId, companyId, companyRole, departmentIds, headOfDepartmentIds,
//           projectRoles: Map<projectId, 'MANAGER'|'MEMBER'|'OBSERVER'>,
//           via: 'web'|'telegram'|'ai'|'api' }
// Scope = { companyId, departmentId?, projectId?, boardId?, taskId?,
//           task?: { creatorId, responsibleId, executorIds, watcherIds } }
```

Одна и та же функция работает на сервере (решает) и на клиенте (прячет кнопки). **Источник истины — сервер**: каждый роут объявляет требуемое право, и middleware отказывает до вызова сервиса.

### 8.2. Роли компании

| Роль | Область видимости | Что может сверх EMPLOYEE |
| --- | --- | --- |
| `SUPER_ADMIN` | вся компания | администрирование: пользователи, роли, workflow, интеграции, физическое удаление, аудит |
| `DIRECTOR` | вся компания | все проекты/задачи как MANAGER, отчёты по всей компании, создание департаментов и проектов; не администрирует пользователей |
| `DEPARTMENT_HEAD` | свои департаменты (+ дочерние) | проекты департамента как MANAGER, состав департамента, отчёты по департаменту, создание проектов в своём департаменте |
| `PROJECT_MANAGER` | проекты, где `project_members.role = MANAGER` | состав проекта, доски, колонки, приёмка задач, отчёты по проекту |
| `EMPLOYEE` | проекты, где состоит | базовая роль: создать задачу, работать над своими, комментировать, загружать файлы |
| `OBSERVER` | проекты, где состоит | только чтение + комментарии |
| `GUEST` | конкретные задачи (через `task_watchers`) | только чтение задач, куда добавлен; не видит список проектов и людей |

Роли проекта (`project_members.role`): `MANAGER` / `MEMBER` / `OBSERVER`. Они ограничивают сверху, не расширяют: EMPLOYEE с `MANAGER` в проекте управляет этим проектом; PROJECT\_MANAGER с `OBSERVER` в чужом проекте только смотрит.

### 8.3. Матрица прав (ядро)

Обозначения: ✔ — всегда в области видимости; **own** — только если создатель / ответственный / исполнитель; **mgr** — если MANAGER проекта (или выше по компании); — нет.

| Право | SUPER\_ADMIN | DIRECTOR | DEPT\_HEAD | PROJ\_MGR | EMPLOYEE | OBSERVER | GUEST |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `company.manage` | ✔ | — | — | — | — | — | — |
| `company.members.manage` | ✔ | — | — | — | — | — | — |
| `department.create` | ✔ | ✔ | — | — | — | — | — |
| `department.members.manage` | ✔ | ✔ | свой | — | — | — | — |
| `project.create` | ✔ | ✔ | в своём | — | — | — | — |
| `project.manage` (состав, архив, workflow) | ✔ | ✔ | свой депт | mgr | mgr | — | — |
| `board.manage` (создать/колонки) | ✔ | ✔ | свой депт | mgr | mgr | — | — |
| `task.view` | ✔ | ✔ | свой депт | в проекте | в проекте | в проекте | watcher |
| `task.create` | ✔ | ✔ | свой депт | в проекте | в проекте | — | — |
| `task.edit` (текст, сроки, метки) | ✔ | ✔ | свой депт | mgr | own | — | — |
| `task.assign` | ✔ | ✔ | свой депт | mgr | own (создатель/отв.) | — | — |
| `task.move` (колонка без статуса) | ✔ | ✔ | свой депт | mgr | own | — | — |
| `task.transition` | по таблице §7.2 | по §7.2 | по §7.2 | по §7.2 | по §7.2 | — | — |
| `task.archive` | ✔ | ✔ | свой депт | mgr | создатель, если NEW | — | — |
| `task.delete` (физически) | ✔ | — | — | — | — | — | — |
| `comment.create` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| `comment.edit` / `delete` | ✔ | свой | свой | свой | свой | свой | — |
| `file.upload` | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |
| `file.delete` | ✔ | ✔ | свой депт | mgr | свой | — | — |
| `report.company` | ✔ | ✔ | — | — | — | — | — |
| `report.department` | ✔ | ✔ | свой | — | — | — | — |
| `report.project` | ✔ | ✔ | свой депт | mgr | — | — | — |
| `admin.audit_log` | ✔ | чтение | — | — | — | — | — |
| `admin.integrations` | ✔ | — | — | — | — | — | — |

Полная матрица фиксируется как таблица в коде и проверяется **табличным тестом**: каждая ячейка — отдельный тест-кейс (§15.4).

### 8.4. Как применяется на сервере

```ts
// apps/api/src/modules/tasks/routes.ts
app.patch('/tasks/:id', {
  preHandler: [requireAuth, requireCompany],
  schema: { body: UpdateTaskBody, params: TaskIdParams },
}, async (req, reply) => {
  const task = await tasks.loadScoped(req.ctx, req.params.id);   // 404 если чужая company
  authorize(req.ctx.actor, 'task.edit', scopeOf(task));          // 403
  return tasks.update(req.ctx, task, req.body);
});
```

Правила:

1. **Сначала scope, потом право.** `loadScoped` всегда фильтрует по `company_id` актора.
2. **Нет права на просмотр — `404`, даже внутри своей компании.** Сотрудник проекта A, подставивший ID задачи проекта B, получает `404` и не узнаёт, что задача существует. `403` — только когда сущность видна, но действие запрещено.
3. **`authorize` бросает исключение, а не возвращает boolean.** Забыть проверить результат невозможно.
4. **Роут без `authorize` не проходит CI.** Lint-правило требует вызова `authorize` или явной пометки `public: true` в каждом хендлере.
5. **Каждый ID из тела и query проверяется так же, как ID из пути.** Это `projectId`, `boardId`, `columnId`, `parentTaskId`, `labelId`, `fileId`, исполнитель, наблюдатель, ответственный. Исполнитель должен быть участником проекта, метка — из этой компании, колонка — из этой доски. Вложенные сущности (пункт чеклиста, комментарий, файл) авторизуются через свою задачу.
6. **Списки фильтруются SQL, а не после выборки.** Для `GET /tasks` репозиторий получает `visibilityFilter(actor)`. Для DIRECTOR это `company_id = $1`, для EMPLOYEE — `project_id IN (…его проекты)`, для GUEST — только задачи из `task_watchers`. Поиск и `GET /tasks/by-code/:code` идут через тот же фильтр.
7. **Actor собирается из БД на каждый запрос,** а не берётся из cookie или токена. Смена роли и исключение из проекта действуют со следующего запроса; realtime пересматривает подписки (§11).
8. **AI, Telegram и внешние API-токены — обычные акторы** с правами конкретного пользователя (§22). Системный актор (`kind: 'system'`) есть только у воркера: дайджесты, recurring. От имени людей он не действует.

### 8.5. Data isolation

- **Код.** Каждая функция репозитория принимает `ctx` с `companyId` первым аргументом. Функций без `ctx` в `repo.ts` нет, это проверяет lint.
- **База.** Составные tenant-FK (§5.1) делают связь между компаниями невозможной даже при ошибке в сервисе. Это второй рубеж после кода, он проверен в §20.2.
- **Тесты (§15.5)** проходят по всем роутам в трёх вариантах. Первый — ID из другой компании. Второй — ID из чужого проекта внутри своей компании. Третий — чужой ID в теле запроса. Ожидается `404` или `422`, никогда не `2xx`.
- **Файлы** лежат в приватном bucket под префиксом `{company_id}/` и отдаются только через presigned URL после `authorize` (§12).
- **WebSocket-подписки** проверяются при подписке и перепроверяются при изменении членства (§11).

### 8.6. Открытые вопросы владельцу

- **R-1.** Видит ли EMPLOYEE все задачи своего проекта или только свои? В драфте — все задачи проекта (как в v1).
- **R-2.** Может ли DEPARTMENT\_HEAD видеть кросс-департаментные проекты (`department_id IS NULL`), в которых участвуют его люди? В драфте — только если сам состоит в проекте.
- **R-3.** Нужен ли GUEST в v1.0 вообще (внешние подрядчики)? Если нет — роль остаётся в enum, но не назначается до Phase 20.

## 9. API Architecture

### 9.1. Общие правила

- REST, JSON, префикс `/api/v1`. Версия в пути, чтобы Telegram-бот, мобильный клиент и интеграции могли отставать от веба.
- Контракт каждого эндпоинта — zod-схемы в `packages/shared/src/contracts/<module>.ts`: params, query, body, response. Сервер валидирует вход всегда, выход — в test и dev, чтобы ловить утечки полей. Клиент импортирует те же схемы.
- OpenAPI 3.1 генерируется из zod (`@fastify/swagger` + `fastify-type-provider-zod`) и коммитится как `docs/api/openapi.json`. Расхождение с кодом — падение CI. Это же — контракт для внешних систем (§22).
- Идентификаторы в URL — только uuid. Код задачи (`TASK-1842`) — через отдельный резолвер `GET /tasks/by-code/:code`.
- Время — ISO 8601 с зоной; сервер отдаёт UTC.
- Списки — cursor-пагинация (`?cursor=&limit=`), лимит не больше 200, без offset.
- **`If-Match` обязателен** для любой мутации существующей строки (§6.5). Ответ на чтение отдаёт `ETag: "<version>"`.
- **`Idempotency-Key` обязателен** для создания: задачи, подзадачи, комментария, upload intent. Ключ записывается первой командой транзакции мутации, ответ сохраняется в той же транзакции. Повтор получает сохранённый ответ, параллельный дубликат ждёт первый и получает его ответ (проверено, §20.2). Тот же ключ с другим телом → `422 IDEMPOTENCY_KEY_REUSED`. Откат транзакции удаляет и ключ, поэтому повтор после ошибки разрешён. Ключи живут 24 ч.

```sql
CREATE TABLE idempotency_keys (
  user_id          uuid NOT NULL REFERENCES users (id),
  key              uuid NOT NULL,
  company_id       uuid NOT NULL,
  method           text NOT NULL,
  route            text NOT NULL,
  request_hash     text NOT NULL,            -- sha256 тела
  response_status  integer,
  response_body    jsonb,                    -- JSONB оправдан: хранится ответ целиком
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  PRIMARY KEY (user_id, key)
);
```

### 9.2. Формат ошибок

```json
{
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "Переход из «Новая» в «Выполнена» недопустим",
    "details": { "from": "NEW", "to": "COMPLETED" },
    "requestId": "01J8…"
  }
}
```

| HTTP | Когда |
| --- | --- |
| 400 | невалидный вход (zod), `details.issues[]`; неизвестное поле в теле |
| 401 | нет сессии, сессия истекла или отозвана |
| 403 | сущность видна, но действие запрещено; чужой `Origin` на мутации |
| 404 | нет сущности, она в другой компании или нет права её видеть |
| 409 | `VERSION_CONFLICT` — `If-Match` не совпал, в `details` текущая версия и состояние; дубликат уникального значения |
| 413 | тело больше 1 МБ |
| 422 | бизнес-правило: переход, цикл зависимостей, WIP-лимит, открытые подзадачи, повторно использованный ключ |
| 428 | `PRECONDITION_REQUIRED` — мутация без `If-Match` или создание без `Idempotency-Key` |
| 429 | rate limit, `Retry-After` |
| 500 | непредвиденное; в теле только `requestId`, без деталей |

`code` — стабильный машинный ключ из enum в `packages/shared`; фронт переводит его сам, `message` — fallback.

### 9.3. Карта эндпоинтов (Phase 2–9)

| Модуль | Эндпоинты |
| --- | --- |
| auth | `POST /auth/login`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/me`, `POST /auth/switch-company`, `POST /auth/register/request-code`, `POST /auth/register/confirm`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/password/change`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `GET /auth/login-history` |
| company | `GET /company`, `PATCH /company`, `GET /company/members`, `POST /company/members/invite`, `PATCH /company/members/:userId` (роль), `POST /company/members/:userId/deactivate` |
| departments | `GET /departments`, `POST /departments`, `PATCH /departments/:id`, `POST /departments/:id/archive`, `POST /departments/:id/members`, `DELETE /departments/:id/members/:userId` |
| projects | `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `POST /projects/:id/archive`, `POST /projects/:id/restore`, `POST /projects/:id/members`, `PATCH /projects/:id/members/:userId`, `DELETE /projects/:id/members/:userId` |
| boards | `GET /projects/:id/boards`, `POST /projects/:id/boards`, `GET /boards/:id` (доска + колонки + карточки в кратком виде), `PATCH /boards/:id`, `POST /boards/:id/archive`, `POST /boards/:id/columns`, `PATCH /columns/:id`, `POST /columns/:id/reorder`, `DELETE /columns/:id` (только пустую) |
| tasks | `GET /tasks` (фильтры: project, board, status, executor, responsible, deadline range, label, q), `POST /tasks`, `GET /tasks/:id` (полная карточка + `allowedActions`), `PATCH /tasks/:id`, `POST /tasks/:id/move`, `POST /tasks/:id/transition`, `POST /tasks/:id/archive`, `POST /tasks/:id/restore`, `GET /tasks/:id/history`, `GET /tasks/by-code/:code` |
| участники и метки | `POST /tasks/:id/executors`, `DELETE /tasks/:id/executors/:userId`, `POST /tasks/:id/watchers`, `DELETE /tasks/:id/watchers/:userId`, `POST /tasks/:id/labels`, `DELETE /tasks/:id/labels/:labelId` — add/remove одного элемента, без замены списка |
| subtasks | `POST /tasks/:id/subtasks`; список входит в `GET /tasks/:id` |
| dependencies | `POST /tasks/:id/dependencies`, `DELETE /tasks/:id/dependencies/:dependsOnId` (Phase 13) |
| checklists | `POST /tasks/:id/checklists`, `PATCH /checklists/:id`, `DELETE /checklists/:id`, `POST /checklists/:id/items`, `PATCH /checklist-items/:id`, `DELETE /checklist-items/:id` |
| comments | `GET /tasks/:id/comments` (cursor), `POST /tasks/:id/comments`, `PATCH /comments/:id`, `DELETE /comments/:id` (soft) |
| files | `POST /files/upload-intents`, `POST /files/:id/finalize`, `GET /files/:id/download-url`, `DELETE /files/:id`, `POST /tasks/:id/files`, `DELETE /tasks/:id/files/:fileId` |
| time | `POST /tasks/:id/time-entries`, `DELETE /time-entries/:id` |
| me | `GET /me/day`, `GET /me/tasks`, `GET /me/inbox`, `POST /me/inbox/:id/read`, `POST /me/inbox/read-all`, `GET /me/notification-preferences`, `PATCH /me/notification-preferences` |
| workflows | `GET /workflows`, `POST /workflows`, `GET /workflows/:id`, `PUT /workflows/:id/definition` (статусы и переходы целиком, с `If-Match` на версию workflow) |
| system | `GET /health` (liveness, без авторизации), `GET /health/ready` (PostgreSQL, Redis, MinIO; наружу — только общий статус) |

Аналитика (`/reports/*`), Telegram (`/integrations/telegram/*`), AI (`/ai/*`), шаблоны и автоматизации — в своих фазах, по тем же правилам.

### 9.4. Слои внутри модуля

```
modules/tasks/
  routes.ts        — Fastify-роуты: schema, preHandler, authorize, вызов сервиса
  service.ts       — бизнес-логика; открывает транзакцию, вызывает repo, emit()
  repo.ts          — только SQL (Drizzle); каждая функция приниает ctx + tx
  mappers.ts       — строка БД → DTO из contracts (никаких лишних полей наружу)
  service.test.ts  — юнит с in-memory repo
  routes.test.ts   — API-тест против реальной PG
```

Запреты: `routes.ts` не трогает БД; `repo.ts` не знает про HTTP и права; `service.ts` не импортирует Fastify. Модуль обращается к другому модулю только через его `service.ts`, никогда — через `repo.ts`.

### 9.5. Сессия и контекст запроса

Каждый запрос получает `req.ctx: RequestContext`:

```ts
interface RequestContext {
  requestId: string;            // ulid, в логах и в ответе
  actor: Actor;                 // из сессии (§8.1)
  companyId: string;            // активная компания сессии
  now: () => Date;              // инъекция времени для тестов
  log: Logger;                  // pino child с requestId, userId, companyId
}
```

Пользователь с несколькими компаниями переключает активную через `POST /auth/switch-company` — это меняет `sessions.company_id`, а не заголовок запроса. Заголовок вида `X-Company-Id` от клиента **не принимается**: компания — свойство сессии на сервере.

### 9.6. Что уходит из v1

- `GET/PUT /api/board` целиком — нет. Доска читается одним `GET /boards/:id`, меняется точечными запросами.
- `X-Board-Version` — заменён `If-Match` на уровне задачи (§6.5).
- Автосохранение по таймеру — нет. Каждое действия пользователя = один запрос с optimistic update на клиенте и откатом при ошибке.

## 10. Domain Events & Outbox

### 10.1. Зачем две таблицы

- `domain_events` — **журнал фактов**. Неизменяемый, хранится вечно. Источник для аналитики, истории задачи, аудита, AI-фактов.
- `outbox` — **очередь доставки**. Строка живёт, пока событие не обработано всеми подписчиками (realtime, notifications, telegram, webhooks). Потом удаляется.

Обе записи делаются **в той же транзакции**, что и изменение данных. Иначе повторится ситуация v1: данные есть, событий нет.

### 10.2. Схема

```sql
CREATE TABLE domain_events (              -- журнал; без FK на сущности, переживает любой архив
  id             uuid PRIMARY KEY,         -- v7
  company_id     uuid NOT NULL,
  type           text NOT NULL,            -- 'task.completed'
  entity_type    text NOT NULL,            -- 'task' | 'comment' | 'file' | ...
  entity_id      uuid NOT NULL,
  actor_user_id  uuid,                     -- NULL = system
  actor_kind     text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','system','integration')),
  via            text CHECK (via IN ('web','telegram','ai','api','worker')),
  payload        jsonb NOT NULL,           -- снимок, проверен zod-схемой типа
  request_id     text,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON domain_events (company_id, occurred_at);
CREATE INDEX ON domain_events (entity_type, entity_id, occurred_at);

CREATE TABLE outbox (                      -- одна строка на пару (событие, обработчик)
  event_id         uuid NOT NULL REFERENCES domain_events (id),
  handler          text NOT NULL,          -- 'realtime' | 'notifications' | 'telegram' | 'email' | 'webhooks'
  company_id       uuid NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done')),
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  locked_by        text,                   -- id экземпляра воркера
  locked_at        timestamptz,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz,
  PRIMARY KEY (event_id, handler)
);
CREATE INDEX outbox_ready ON outbox (next_attempt_at) WHERE status = 'pending';

CREATE TABLE outbox_dead_letter (
  event_id    uuid NOT NULL REFERENCES domain_events (id),
  handler     text NOT NULL,
  company_id  uuid NOT NULL,
  attempts    integer NOT NULL,
  last_error  text NOT NULL,
  failed_at   timestamptz NOT NULL DEFAULT now(),
  retried_at  timestamptz,
  PRIMARY KEY (event_id, handler)
);
```

Почему строка на обработчик, а не на событие: если Telegram лежит час, realtime и in-app уведомления доставляются сразу, а в dead-letter уходит только строка Telegram. Payload хранится один раз в `domain_events`.

### 10.3. Каталог событий v1.0

Каждый тип — zod-схема payload в `packages/shared/src/events/<type>.ts`. `emit()` отказывается писать payload, не прошедший схему.

| Тип | Когда | Payload (ключевые поля) |
| --- | --- | --- |
| `task.created` | создание задачи или подзадачи | taskId, code, projectId, boardId?, parentTaskId?, title, creatorId, responsibleId, executorIds, deadlineAt |
| `task.updated` | PATCH полей, кроме перечисленных ниже | taskId, changed: { field: {from, to} } |
| `task.assigned` / `task.unassigned` | добавлен / убран исполнитель | taskId, userId, byUserId |
| `task.watcher_added` / `task.watcher_removed` | наблюдатели | taskId, userId |
| `task.responsible_changed` | смена ответственного | taskId, from, to |
| `task.deadline_changed` | смена срока | taskId, from, to |
| `task.moved` | перенос на доске | taskId, from { boardId, columnId }, to { boardId, columnId }, position |
| `task.accepted` / `started` / `blocked` / `sent_for_review` / `review_withdrawn` / `revision_requested` / `completed` / `closed` / `reopened` | переход workflow | taskId, actionKey, fromStatus, toStatus, comment? |
| `task.archived` / `task.restored` | архив | taskId, reason |
| `dependency.added` / `dependency.removed` | зависимости | taskId, dependsOnId, kind |
| `checklist_item.toggled` | пункт чеклиста | taskId, itemId, done |
| `comment.created` / `edited` / `deleted` | комментарии | commentId, taskId, authorId, mentionedUserIds |
| `file.uploaded` / `file.deleted` | файлы | fileId, entityType, entityId, name, size, mime |
| `member.invited` / `role_changed` / `deactivated`, `project.member_added` / `member_removed` | состав | userId, role, projectId? |
| `auth.login` / `logout` / `login_failed` / `password_changed` / `session_revoked` | auth | userId, ip, userAgentHash |

Для аналитики `packages/analytics` читает `task_status_history` + `domain_events`, а не только текущее состояние `tasks`. Это то, чего не хватало v1 (пустой `core_events`).

### 10.4. `emit()` и транзакция

```ts
// core/events/emit.ts
export async function emit<T extends EventType>(
  tx: Transaction, ctx: RequestContext, type: T, entity: EntityRef, payload: EventPayload<T>
): Promise<void> {
  const parsed = EVENT_SCHEMAS[type].parse(payload);          // бросает → откат всей транзакции
  const eventId = uuidv7();
  await tx.insert(domainEvents).values({
    id: eventId, companyId: ctx.companyId, type, entityType: entity.type, entityId: entity.id,
    actorUserId: ctx.actor.userId, actorKind: ctx.actor.kind, via: ctx.actor.via,
    payload: parsed, requestId: ctx.requestId,
  });
  const handlers = HANDLERS_BY_TYPE[type];                      // статический реестр в packages/shared
  if (handlers.length > 0) {
    await tx.insert(outbox).values(handlers.map(handler => ({ eventId, handler, companyId: ctx.companyId })));
    await tx.execute(sql`SELECT pg_notify('outbox_new', '')`);   // доставляется только после COMMIT
  }
}
```

Правило: сервис никогда не пишет в `domain_events` напрямую и никогда не вызывает `emit` вне `tx`. Нет `tx` — нет сигнатуры, не компилируется.

### 10.5. Воркер (`apps/worker`)

Воркер просыпается по `LISTEN outbox_new` и для подстраховки раз в секунду. Захват пачки:

```sql
UPDATE outbox
   SET status = 'processing', locked_by = $1, locked_at = now(), attempts = attempts + 1
 WHERE (event_id, handler) IN (
   SELECT event_id, handler FROM outbox
    WHERE status = 'pending' AND next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
 )
RETURNING event_id, handler, attempts;
```

Каждая захваченная строка уходит в свой обработчик. Обработчик обязан быть идемпотентным по тройке «событие, обработчик, получатель»:

- **realtime** — повторная публикация безвредна: клиент отбрасывает уже виденный `eventId` (§11).
- **notifications** — `INSERT … ON CONFLICT (event_id, user_id) DO NOTHING`.
- **telegram, email** — сначала строка в `telegram_deliveries` / `email_deliveries` с UNIQUE-ключом, потом отправка. Уже отправленное пропускается. Дубль возможен только если внешний вызов прошёл, а отметка об отправке не сохранилась: это принятая цена at-least-once.

* Успех → `status = 'done'`, `processed_at = now()`. Строки `done` удаляются сборщиком через 24 ч; событие остаётся в `domain_events` навсегда.
* Ошибка → `status = 'pending'`, `next_attempt_at = now() + min(5 с × 2^(attempts−1), 1 ч)` со случайным разбросом ±20 %, `last_error`.
* `attempts = 12` → строка переносится в `outbox_dead_letter` в одной транзакции с удалением из `outbox`. Это окно повторов около 3,5 ч: короткий сбой Telegram или SMTP не доходит до dead-letter.
* `processing` старше 5 мин → отдельный свип возвращает в `pending`: воркер упал посередине.
* Обработчики независимы: ошибка одного не задерживает и не повторяет другие.

Один воркер в v1.0; `SKIP LOCKED` позволяет запустить второй без изменения кода.

**Наблюдаемость.**

| Что | Как |
| --- | --- |
| Метрики | `outbox_pending{handler}`, `outbox_oldest_pending_seconds{handler}`, `outbox_processed_total{handler,result}`, `outbox_dead_letter_total{handler}`, `outbox_handler_duration_seconds{handler}` |
| Логи | каждая попытка — строка pino: `eventId`, `type`, `handler`, `attempt`, `durationMs`, `result`, `error` |
| Трассировка | `requestId` исходного HTTP-запроса лежит в событии; по нему видна цепочка от клика до сообщения в Telegram |
| Алерты | dead-letter больше 0; самая старая `pending` старше 5 мин |
| Управление | `GET /admin/outbox?status=dead`, `POST /admin/outbox/:eventId/:handler/retry` — только SUPER\_ADMIN, с записью в аудит (Phase 22) |

### 10.6. Гарантии

| Свойство | Гарантия |
| --- | --- |
| Событие записано ⇔ изменение закоммичено | да, одна транзакция PostgreSQL |
| Успех бизнес-операции зависит от Telegram, email, WebSocket | нет: API не вызывает внешние сервисы внутри запроса, всё это делает воркер после коммита |
| Доставка обработчику | at-least-once, отдельно по каждому обработчику |
| Порядок | не гарантируется; потребители от него не зависят (§11.3) |
| Задержка до realtime | обычно меньше 1 с благодаря `LISTEN/NOTIFY` |
| Падение воркера | потерь нет: строка остаётся в `outbox` |
| Падение Redis | потерь нет: realtime уходит в повторы, клиенты догоняют через refetch |
| Отказ Telegram или SMTP | повторы около 3,5 ч, затем dead-letter и алерт; другие обработчики не затронуты |

### 10.7. Что не делаем

- Event sourcing (состояние из событий) — нет. Таблицы — источник истины, события — журнал.
- Внешний брокер (RabbitMQ/Kafka) — нет. PostgreSQL + `SKIP LOCKED` достаточно для ожидаемых объёмов (сотни событий в минуту пиком).
- Детерминированный `event_key` через хэш payload (v1) — не нужен: событие рождается один раз в транзакции мутации, дедупликация на входе обеспечивается `Idempotency-Key` (§9.1).

## 11. Realtime Architecture

### 11.1. Цель

Два сотрудника смотрят одну доску: перенос карточки у одного появляется у другого без F5 и без конфликта. В v1 это решалось polling'ом всей доски и 409 на всю доску.

### 11.2. Транспорт

- **Транспорт.** WebSocket на `/api/v1/ws`, тот же origin через Caddy, библиотека `@fastify/websocket`. Socket.IO не нужен: не нужны fallback-транспорты и свой протокол.
- **Аутентификация.** Cookie сессии проверяется при upgrade так же, как в REST. Заголовок `Origin` должен совпадать с `APP_ORIGIN`: это защита от cross-site WebSocket hijacking. Без сессии upgrade завершается `401`.
- **Направление.** Клиент отправляет только subscribe, unsubscribe и ping. Мутаций через сокет нет.
- **Подписки.** Клиент просит каналы `board:<id>`, `task:<id>`, `project:<id>`; `user:me` подключается автоматически. Каждый канал проходит через тот же `authorize` (`board.view`, `task.view`, `project.view`). Отказ не отличается от несуществующего канала.
- **Перепроверка прав.** События смены роли, исключения из проекта и деактивации заставляют шлюз пересчитать Actor и снять ставшие недоступными подписки. `session_revoked` и `password_changed` закрывают все сокеты пользователя с кодом 4401. Для подстраховки сессия перепроверяется каждые 60 с.
- **Heartbeat.** Ping/pong каждые 30 с; два пропущенных pong подряд разрывают соединение.

### 11.3. Поток событий

```
service ─emit()─► domain_events + outbox ─► worker ─PUBLISH─► Redis channel "rt"
                                                            │
                        api#1 ◄─SUBSCRIBE──────────────────────┤
                        api#2 ◄─SUBSCRIBE──────────────────────┘
                          │
                          └─ для каждого локального сокета с подпиской на канал → send()
```

Сообщение клиенту — **уведомление об изменении, а не данные**:

```json
{ "channel": "board:8b1…", "type": "task.moved", "entityId": "019…", "eventId": "019…", "at": "2026-09-20T09:00:00Z" }
```

Клиент делает `queryClient.invalidateQueries(['task', entityId])` / `['board', boardId]` и TanStack Query перезапрашивает через обычный REST. Почему так:

- Авторизация данных остаётся в одном месте (REST). Сокет не может случайно отдать поле, которое актору не положено.
- Пропущенные сообщения (реконнект, сон ноутбука) не ломают состояние: при `onReconnect` клиент инвалидирует все активные подписки.
- Нет двух форматов одних данных (REST DTO и socket DTO).

Исключение: чат задачи (`comment.created`) несёт тело комментария в событии — иначе чат ощущается медленным. Подписка на `task:<id>` уже проверена правом `task.view`, которое включает чтение комментариев.

### 11.4. Каналы

| Канал | Кто подписывается | События |
| --- | --- | --- |
| `board:<id>` | открытая доска | task.created/moved/updated/transition/archived, column.\* |
| `task:<id>` | открытая карточка | всё по задаче + comment.\* + file.\* + checklist.\* |
| `user:me` | всегда | notification.created, session.revoked (→ принудительный logout), task.assigned на меня |
| `project:<id>` | список досок / таблица / календарь | board.*, агрегированные task.* (throttle 1 с) |

Присутствие («кто смотрит доску») — Redis `SET presence:board:<id>` с TTL 60 с, обновляется heartbeat'ом. Не пишется в PG.

### 11.5. Отказоустойчивость

- Redis недоступен → API работает, сокеты молчат. Шлюз шлёт `ws.degraded`, клиент включает refetch раз в 30 с. Воркер держит строки realtime в повторах (§10.5).
- Экземпляр API упал → клиент переподключается с backoff 1–30 с, повторяет подписки и инвалидирует кеш.
- Лимиты: 10 соединений на пользователя, 50 подписок на соединение, сообщение клиента не больше 4 КБ. Превышение — закрытие с кодом 4429.

**Гарантии realtime:**

| Свойство | Решение |
| --- | --- |
| Утечка данных через сокет | сообщение несёт только тип, id и `eventId`; данные клиент берёт через REST с полной авторизацией. Исключение — тело комментария в канале `task:<id>`, уже прошедшем `task.view` |
| Redis pub/sub | транспорт без хранения; воркер публикует в `rt:{companyId}`, каждый экземпляр API раздаёт своим сокетам по подпискам |
| Пропущенные события | не воспроизводятся: после reconnect клиент инвалидирует все активные запросы и перечитывает состояние |
| Порядок | не важен: сообщение только инвалидирует кеш; кеш не принимает ответ с меньшей `version` (§6.5); комментарии сортируются по `(created_at, id)` |
| Дубли | клиент помнит последние 1000 `eventId` и пропускает повторы; инвалидация идемпотентна |
| Собственные действия | клиент не перечитывает то, что сам только что изменил: `requestId` события совпадает с его запросом. Это убирает «прыжки» карточек (риск R-8) |

### 11.6. Что не делаем

- CRDT / OT для совместного редактирования описания — нет. Конфликт описания решается `If-Match` + диалог «описание изменено другим пользователем».
- Server-Sent Events как fallback — нет. Caddy проксирует WebSocket без настройки; корпоративные прокси, режущие WS, в IT-HONA не зафиксированы (проверить в Phase 24, Risk #R-7).

## 12. Files Architecture

### 12.1. Разделение

- **PostgreSQL** — метаданные: кто загрузил, когда, размер, тип, к чему привязан, статус.
- **MinIO** — байты. Один bucket `hona`, **приватный**: anonymous-политика `none`, публичных ссылок нет. Ключ объекта — `{company_id}/{yyyy}/{mm}/{file_id}`. Пользовательский ввод в ключ не попадает: нет path traversal, проблем с unicode и коллизий.
- **Байты не проходят через API.** Браузер работает с MinIO по presigned-ссылкам на **отдельном поддомене** `files.<domain>`. Caddy проксирует его без изменения Host, у MinIO задан `MINIO_SERVER_URL`, S3-клиент подписывает ссылки публичным endpoint. Путь `/s3/*` на основном домене из Draft не работает: подпись SigV4 включает Host и путь.
- **CORS bucket** разрешает только `APP_ORIGIN` и методы POST, GET, HEAD.

### 12.2. Схема

```sql
CREATE TABLE files (
  id                 uuid PRIMARY KEY,
  company_id         uuid NOT NULL REFERENCES companies (id),
  uploader_id        uuid NOT NULL REFERENCES users (id),
  name               text NOT NULL CHECK (length(name) BETWEEN 1 AND 255),  -- только для отображения
  declared_mime      text NOT NULL,                  -- что заявил клиент
  mime               text,                           -- что определено по содержимому при finalize
  size_bytes         bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  sha256             text,                           -- считает воркер
  storage_key        text NOT NULL UNIQUE,           -- '{company_id}/{yyyy}/{mm}/{file_id}'
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','ready','quarantined','deleted','purged')),
  upload_expires_at  timestamptz NOT NULL,           -- срок upload intent
  created_at         timestamptz NOT NULL DEFAULT now(),
  finalized_at       timestamptz,
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES users (id),
  purged_at          timestamptz,                    -- байты удалены, строка остаётся
  UNIQUE (company_id, id)
);

CREATE TABLE file_links (                  -- файл может быть привязан к нескольким сущностям
  company_id   uuid NOT NULL,
  file_id      uuid NOT NULL,
  entity_type  text NOT NULL CHECK (entity_type IN ('task','comment','project','user_avatar')),
  entity_id    uuid NOT NULL,              -- полиморфная ссылка: проверяет сервис через loadScoped
  linked_by    uuid NOT NULL REFERENCES users (id),
  linked_at    timestamptz NOT NULL DEFAULT now(),
  unlinked_at  timestamptz,
  PRIMARY KEY (file_id, entity_type, entity_id),
  FOREIGN KEY (company_id, file_id) REFERENCES files (company_id, id)
);
```

### 12.3. Загрузка (три шага)

1. **Запрос и проверка прав.** `POST /files/upload-intents { name, mime, size, target: { entityType, entityId } }` с `Idempotency-Key`. Сервер загружает target через `loadScoped` и вызывает `authorize('file.upload')`. Проверяются размер до 100 МБ, mime из allow-list и квота компании с учётом `pending`.
2. **Upload intent.** Строка `files` со `status = 'pending'` и `upload_expires_at = now() + 15 мин`.
3. **Presigned URL.** Сервер возвращает presigned **POST** с политикой: точный `key`, точный `Content-Type`, `content-length-range` от 1 до заявленного размера, срок 15 мин. Лимит размера проверяет сам MinIO; presigned PUT такого не умеет.
4. **Upload.** Браузер отправляет файл напрямую в MinIO.
5. **Finalize.** `POST /files/:id/finalize` — только загрузивший, только `pending`, только до истечения intent. Сервер делает `HeadObject` (размер = заявленному) и читает первые 4 КБ для проверки сигнатуры файла. Реальный тип должен быть в allow-list и совместим с заявленным. Несовпадение → объект удаляется, `status = 'quarantined'`, ответ `422 UPLOAD_MISMATCH`.
6. **Метаданные.** В одной транзакции: `status = 'ready'`, `mime`, `finalized_at`, строка `file_links` к target, `emit('file.uploaded')`. `sha256` позже посчитает воркер.

**Очистка сирот** — воркер, раз в час:

- `pending` с истёкшим intent старше 1 ч → объект удаляется, если был, строка получает `status = 'purged'`.
- `deleted` старше 30 дней → объект удаляется, `status = 'purged'`, `purged_at`.
- `quarantined` → объект удаляется сразу, строка остаётся для аудита.
- Раз в неделю — сверка: объекты без строки в `files` удаляются, строки `ready` без объекта дают алерт.

### 12.4. Скачивание

`GET /files/:id/download-url` работает только для `ready`. Сервер вызывает `authorize('file.view')` по любой активной привязке и выдаёт presigned GET на 5 минут. В ссылку вшиты `response-content-type` = сохранённый mime и `response-content-disposition: attachment`. `inline` разрешён только для PNG, JPEG, WebP и GIF. Caddy на `files.<domain>` добавляет `X-Content-Type-Options: nosniff`. Утечка ссылки даёт доступ не дольше 5 минут; это принятый риск.

Право на файл = право на хотя бы одну сущность, к которой он привязан. Файл без привязок видит только загрузивший.

### 12.5. Безопасность файлов

- Allow-list mime: документы (pdf, docx, xlsx, pptx, odt, txt, md, csv), изображения (png, jpeg, webp, gif, svg — svg только `attachment`, никогда `inline`), архивы (zip), видео (mp4, webm). Исполняемые и html — нет.
- Сервер проверяет сигнатуру файла по первым 4 КБ синхронно в `finalize` (чтение по Range). Несовпадение с mime → `quarantined`.
- Антивирус (ClamAV) — не в v1.0; место для него — тот же воркер-шаг (Risk #R-9).
- MinIO слушает только внутреннюю сеть docker; наружу — только через Caddy и только presigned. Консоль MinIO (9001) не публикуется.
- Квота компании: `companies.storage_quota_bytes` (по умолчанию 20 ГБ), использование считается `SUM(size_bytes) WHERE status = 'ready'`, кэшируется в Redis 5 мин.

### 12.6. Удаление

`DELETE /files/:id` → `status = 'deleted'`, `deleted_at`, `deleted_by`; привязки получают `unlinked_at`; `emit('file.deleted')`. Байты удаляет воркер через 30 дней — это окно восстановления. Строка `files` остаётся навсегда как след в истории (§21).

## 13. Notifications Architecture

### 13.1. Принцип

Уведомление — это **производная от доменного события**, а не отдельный вызов из сервиса. Сервис задач не знает про Telegram. Подписчик `notifications` в воркере читает outbox, решает кому и через что, создаёт записи и отправляет.

```
outbox event ─► recipients(event) ─► для каждого user:
                                      ├─ INSERT notifications (in-app, всегда)
                                      ├─ preferences → telegram?  ─► telegram_deliveries + send
                                      ├─ preferences → email?     ─► email_deliveries + send
                                      └─ preferences → push?      ─► (Phase 21)
```

### 13.2. Схема

```sql
CREATE TABLE notifications (
  id           uuid PRIMARY KEY,
  company_id   uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id),
  event_id     uuid NOT NULL REFERENCES domain_events(id),
  kind         text NOT NULL,          -- 'task.assigned_to_you', 'mention', 'review_requested', ...
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  title        text NOT NULL,          -- сформирован на момент события
  body         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz,
  UNIQUE (event_id, user_id)           -- идемпотентность воркера
);
CREATE INDEX ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE notification_preferences (
  user_id     uuid NOT NULL REFERENCES users(id),
  company_id  uuid NOT NULL,
  kind        text NOT NULL,           -- или '*' для дефолта
  channels    jsonb NOT NULL,          -- {"in_app":true,"telegram":true,"email":false,"push":false}
  quiet_from  time,                    -- тихие часы в зоне пользователя
  quiet_to    time,
  PRIMARY KEY (user_id, company_id, kind)
);

CREATE TABLE telegram_links (
  user_id      uuid PRIMARY KEY REFERENCES users(id),
  chat_id      bigint NOT NULL UNIQUE,
  linked_at    timestamptz NOT NULL DEFAULT now(),
  link_code    text,                   -- одноразовый код привязки, NULL после привязки
  link_expires timestamptz
);

CREATE TABLE telegram_deliveries (
  event_id    uuid NOT NULL,
  chat_id     bigint NOT NULL,
  message_id  bigint,
  sent_at     timestamptz,
  error       text,
  PRIMARY KEY (event_id, chat_id)
);
-- email_deliveries — аналогично, PK (event_id, user_id)
```

### 13.3. Кто получает что (v1.0)

| Событие | Получатели | kind |
| --- | --- | --- |
| `task.assigned` | новый исполнитель | `task.assigned_to_you` |
| `task.responsible_changed` | новый ответственный | `task.you_are_responsible` |
| `task.sent_for_review` | ответственный (или MANAGER'ы проекта, если нет) | `review_requested` |
| `task.revision_requested` | исполнители | `revision_requested` |
| `task.completed` / `closed` | создатель, наблюдатели | `task.completed` |
| `task.deadline_changed` | исполнители, ответственный | `deadline_changed` |
| `comment.created` с mention | упомянутые | `mention` |
| `comment.created` без mention | исполнители, ответственный, наблюдатели (кроме автора) | `comment` |
| `file.uploaded` | как у `comment` | `file` |
| таймер воркера | исполнители задач с дедлайном через 24 ч / просроченных | `deadline_soon` / `overdue` |
| таймер воркера 09:00 по зоне пользователя | все с включённым дайджестом | `daily_digest` |

Автор действия никогда не получает уведомление о своём действии. Правила получателей — чистые функции в `packages/shared/src/notifications/recipients.ts`, покрыты табличными тестами.

### 13.4. Каналы

| Канал | Фаза | Доставка |
| --- | --- | --- |
| In-App | 14 | `notifications` + realtime `user:me` → бейдж и Inbox |
| Telegram | 15 | Bot API `sendMessage` с inline-кнопками (Открыть / Принять / На проверку). Нажатие → webhook → обычный вызов сервиса от имени привязанного user (§8.4 п.5). **Telegram — не источник истины** |
| Email | 14 | SMTP через nodemailer; только дайджест, приглашения, сброс пароля, коды. Не каждое событие |
| Push (Web Push) | 21 | VAPID, `push_subscriptions`; до этого `channels.push` игнорируется |

Тихие часы: Telegram/Push откладываются до конца окна (строка в `outbox` с `next_attempt_at`), In-App пишется сразу.

### 13.5. Ограничения

- Схлопывание: более 5 событий по одной задаче за 2 минуты для одного получателя — одно Telegram-сообщение «5 обновлений в TASK-1842». In-App не схлопывается.
- Хранение In-App — 90 дней для прочитанных, бессрочно для непрочитанных.
- Telegram-токен старого бота утерян вместе с сервером — в Phase 15 создаётся новый бот, старый отзывается через @BotFather (Risk #R-11).

## 14. Security Architecture

### 14.1. Аутентификация и сессии

| Элемент | Решение |
| --- | --- |
| Пароль | scrypt: N=2^15, r=8, p=1, соль 16 байт, ключ 64 байта. `maxmem` задаётся явно (64 МБ): эти параметры требуют 32 МБ, ровно у границы умолчания Node. Формат `scrypt$N$r$p$salt$hash`. Минимум 10 символов и проверка по списку из 10 000 частых паролей. Если параметры устарели, хэш пересчитывается при логине |
| Сессия | серверная: `sessions (id, user_id, company_id, token_hash, created_at, last_seen_at, expires_at, ip, user_agent, revoked_at, revoke_reason)`. В cookie — случайный токен 32 байта, в БД — его sha256. Утечка дампа БД не даёт сессий |
| Cookie | `__Host-hona_sid`: `HttpOnly; Secure; SameSite=Lax; Path=/`, без `Domain`. Префикс `__Host-` не даёт поддоменам, включая `files.<domain>`, подменить cookie. В dev по http — `hona_sid` без префикса |
| Срок | 14 дней скользящий (`last_seen_at` обновляется не чаще раза в 5 мин), абсолютный максимум 30 дней. Новый токен при каждом логине и смене пароля — защита от session fixation |
| Проверка на каждом запросе | токен найден, не отозван, не истёк; пользователь активен; членство в компании не закрыто |
| Отзыв | смена пароля (самим или админом) отзывает все сессии, кроме текущей; `logout-all`; деактивация отзывает все; `DELETE /auth/sessions/:id`. Это закрывает дефект v1 |
| Rate limit | Redis: логин 5 в минуту на email и 20 в минуту на IP; коды подтверждения 3 в час на email; API 600 в минуту на сессию; ответ `429` + `Retry-After`. При недоступном Redis логин и коды закрываются, остальное работает |
| Блокировка | 10 неудачных входов за 15 мин → аккаунт заморожен на 15 мин, пользователю уходит письмо |
| Аудит входа | `login_history (user_id, at, ip, user_agent, success, reason)` хранится 90 дней и видна пользователю и SUPER\_ADMIN. События `auth.*` в `domain_events` хранятся бессрочно |
| TOTP и recovery codes | обязательная поздняя фаза (Phase 19), §14.2 |

### 14.2. Восстановление доступа

- **Сброс пароля** — токен 32 байта почтой, sha256 в `password_resets`, TTL 30 мин, одноразовый. Ответ `POST /password/forgot` одинаков для существующего и несуществующего email.
- **Админский сброс** — SUPER\_ADMIN генерирует одноразовую ссылку (не пароль), пользователь сам задаёт пароль. Админ никогда не знает пароль. Факт сброса — в `audit_log`.
- **TOTP** (Phase 19) — `otplib`, секрет шифруется AES-256-GCM ключом из env; обязателен для SUPER\_ADMIN и DIRECTOR, опционален для остальных.
- **Recovery codes** (Phase 19) — 10 кодов по 10 символов, хранятся как scrypt-хэши, показываются один раз.
- **Последний SUPER\_ADMIN** не может быть деактивирован или понижен (защита от потери доступа к компании). Аварийный доступ — CLI-команда на сервере `hona admin:reset-superadmin` (требует SSH).

### 14.3. CSRF, заголовки, ввод

- **CSRF.** `SameSite=Lax` плюс обязательная проверка `Origin` (или `Sec-Fetch-Site: same-origin`) на всех не-GET запросах. Нет заголовка или чужой origin → `403`. GET никогда не меняет состояние. Double-submit токен не нужен, пока API и фронт на одном origin.
- **Заголовки** (Caddy + `@fastify/helmet`): `Strict-Transport-Security: max-age=63072000; includeSubDomains`; `Content-Security-Policy: default-src 'self'; connect-src 'self' wss: https://files.<domain>; img-src 'self' data: blob: https://files.<domain>; frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Ввод.** Всё через zod, `.strict()` на объектах: неизвестные поля — `400`. Markdown описаний и комментариев рендерится на клиенте через DOMPurify, raw HTML запрещён. Тело запроса — не больше 1 МБ, файлы идут мимо API (§12).
- **SQL.** Только параметризованные запросы: Drizzle или тег `sql`. Конкатенация строк в SQL — ошибка lint.

### 14.4. Секреты и конфигурация

- Все секреты — только env. На старте zod-схема `Env` проверяет наличие и формат; процесс не поднимается с неполным env. В логи секреты не попадают (pino `redact`).
- `.env` никогда не коммитится и никогда не `source`'ится shell-скриптами (правило из v1 сохраняется). `.env.example` — только имена и примеры формата.
- Секреты старого сервера (Anthropic key, Telegram token, SMTP/Zoho) считаются утерянными и перевыпускаются в Phase 23. Скомпрометированный ранее пароль не переиспользуется.
- GitHub: секреты CI — только в Actions Secrets; в репозитории нет IP серверов, имён хостов, ключей. `gitleaks` в CI (§16).

### 14.5. Аудит

```sql
CREATE TABLE audit_log (
  id             uuid PRIMARY KEY,
  company_id     uuid,
  actor_user_id  uuid,
  action         text NOT NULL,     -- 'member.role_changed', 'password.admin_reset', 'task.hard_deleted', ...
  target_type    text,
  target_id      uuid,
  ip             inet,
  details        jsonb,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
```

В аудит попадают security-значимые действия (роли, сбросы, деактивации, физические удаления, изменения workflow, интеграций, экспорты). Бизнес-события — в `domain_events`. Таблица append-only: роль БД приложения имеет на неё только INSERT и SELECT.

### 14.6. Сеть и процессы

- Снаружи открыты только 80/443 (Caddy) и SSH на нестандартном порту по ключу. PostgreSQL, Redis, MinIO — только docker-сеть, без `ports:` в compose. **PostgreSQL наружу не открывается** ни при каких условиях; доступ — SSH-туннель.
- Роли БД: `hona_app` (DML, без DDL), `hona_migrate` (DDL, только для миграций), `hona_readonly` (для диагностики и аналитики). Приложение не ходит под `postgres`.
- Контейнеры: non-root user, read-only rootfs где возможно, `no-new-privileges`, образы запинены по digest.

### 14.7. Что сознательно отложено

- SSO / OIDC (Google Workspace, Microsoft) — Phase 20, если потребуется.
- WebAuthn/passkeys — после TOTP.
- Шифрование полей БД (кроме TOTP-секретов) — нет; защита — шифрованные бэкапы и закрытая сеть.

## 15. Testing Strategy

### 15.1. Принцип

Каждая фаза сдаётся с тестами, и фаза не считается завершённой, пока её acceptance-тесты не зелёные в CI. Тесты пишутся против **настоящего PostgreSQL**, не моков БД — большинство дефектов v1 были на границе код ↔ БД.

### 15.2. Уровни

| Уровень | Инструмент | Где | Что проверяет | Время в CI |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `packages/*`, `apps/web/src/**` | чистые функции: `can()`, получатели уведомлений, analytics, валидаторы, хуки | до 30 с |
| Integration | Vitest + PostgreSQL | `apps/api/src/modules/*/service.test.ts` | сервис + реальный repo + транзакции + `emit` | 1–2 мин |
| API | Vitest + `app.inject()` | `apps/api/src/modules/*/routes.test.ts` | статусы, схемы ответов, ошибки, заголовки, cookie, `428`/`409` по версиям, `Idempotency-Key` | 1–2 мин |
| Database | Vitest + PostgreSQL | `packages/db/tests/` | миграции применяются с нуля; схема и миграции совпадают (drift); уже влитые файлы миграций не изменены; каждый CHECK, UNIQUE и FK срабатывает; ноль FK с CASCADE. Миграции forward-only, откатов `down` нет | до 1 мин |
| RBAC | табличный (§15.4) | `apps/api/src/core/authz/matrix.test.ts` | каждая ячейка матрицы §8.3 через HTTP | 1 мин |
| Data isolation | генеративный (§15.5) | `apps/api/src/core/isolation.test.ts` | каждый роут × {другая компания, чужой проект, чужой ID в теле} → `404` или `422` | 1 мин |
| Workflow | Vitest + PostgreSQL | `modules/workflow/*.test.ts` | все переходы §7.2 для каждого актора; запрещённые → `422`/`403`; `completed_at` ставится и снимается | до 1 мин |
| Concurrency | Vitest + PostgreSQL, `Promise.all` | `modules/*/concurrency.test.ts` | 50 параллельных созданий → 50 уникальных кодов без пропусков; два PATCH с одним `If-Match` → 200 и 409; гонка A→B / B→A → один `422`; один `Idempotency-Key` дважды → одно исполнение; два воркера не берут одну строку outbox | 1 мин |
| E2E | Playwright + Chromium | `tests/e2e/` | логин → создать задачу → назначить → принять → на проверку → вернуть → завершить; два браузера видят realtime | 3–5 мин |

### 15.3. Фикстуры

`packages/db/seed/test.ts` создаёт детерминированный мир: 2 компании, в каждой по одному пользователю каждой роли, 2 департамента, 2 проекта, доска с 4 колонками и 10 задач в разных статусах. `globalSetup` один раз применяет миграции к базе-шаблону. Каждый воркер Vitest получает свою базу через `CREATE DATABASE … TEMPLATE`, поэтому файлы идут параллельно без взаимного влияния. Между тестами таблицы очищаются одним `TRUNCATE`. Время инъектируется через `ctx.now()`, так что тесты дедлайнов и дайджестов не зависят от часов.

### 15.4. Табличный RBAC-тест

```ts
const MATRIX: Array<[Permission, Role, Fixture, Expected]> = [
  ['task.edit', 'EMPLOYEE', 'ownTaskInProjectA', 200],
  ['task.edit', 'EMPLOYEE', 'othersTaskInProjectA', 403],
  ['task.edit', 'OBSERVER', 'anyTaskInProjectA', 403],
  ['task.view', 'GUEST', 'watchedTask', 200],
  ['task.view', 'GUEST', 'unwatchedTask', 404],
  // ... одна строка на каждую ячейку §8.3
];
test.each(MATRIX)('%s as %s on %s → %d', async (perm, role, fixture, status) => { … });
```

Матрица в тесте и матрица в документации генерируются из одного источника (`packages/shared/src/rbac/matrix.ts`), чтобы не расходиться.

### 15.5. Генеративный тест изоляции

Тест обходит все зарегистрированные роуты Fastify и для каждого делает три проверки. Первая: SUPER\_ADMIN компании A подставляет ID сущности компании B. Вторая: EMPLOYEE проекта A подставляет ID из проекта B той же компании. Третья: чужой ID передаётся в теле запроса (проект, колонка, исполнитель, метка). Ожидается `404` или `422` и ни одного изменения в БД. Новый роут попадает под тест автоматически; исключить его можно только явной записью в allow-list с комментарием.

### 15.6. Что обязательно перед merge в main

- Unit + Integration + API + Database + RBAC + Isolation + Workflow + Concurrency — зелёные (§16).
- Покрытие: `packages/shared` и `apps/api/src/core` ≥ 90 % строк; `modules/*` ≥ 80 %. Падение покрытия относительно main — предупреждение, не блокер.
- E2E — обязательны с Phase 6 (появляется первый полный сценарий).

### 15.7. Что берём из v1

Единый раннер — Vitest: один конфиг, один отчёт, воркспейсы. Тесты легаси `tests/unit/analytics.test.ts` переносятся в `packages/analytics` в Phase 12 без изменения ожидаемых результатов; меняется только фикстура, которая строит индекс. Это регрессионная сетка для KEEP-кода.

## 16. GitHub Workflow & CI/CD

### 16.1. Ветки

| Ветка | Назначение | Защита |
| --- | --- | --- |
| `main` | стабильный v1 с тегом `v1-final`. Сейчас такой ветки нет, см. предусловия в §0 | PR only, required checks, без force push |
| `develop-2.0` | интеграционная ветка 2.0 на Phase 1–21. Создаётся в начале Phase 1 от `main` или, пока `main` нет, от `25f9125` | PR only, required checks, без force push |
| ветка фазы | одна фаза = одна ветка = один PR в `develop-2.0`. Сессия Claude Code работает в назначенной ей ветке `claude/*` | — |

Почему `develop-2.0`, а не сразу `main`: `main` остаётся работающим снимком v1 — справочником и базой для Phase 26, если найдётся бэкап. Правило «`main` стабилен, без force push» соблюдается. В Phase 22 `develop-2.0` вливается в `main` одним PR. Удаление легаси из рабочей линии — отдельное решение владельца, история остаётся в теге `v1-final`.

**D-3 утверждено 23.09.2026:** текущий репозиторий + `develop-2.0`, новый репозиторий не создаётся. Переименование репозитория в `hona-core` возможно в Phase 22 по желанию владельца; GitHub сохраняет редиректы.

### 16.2. Правила PR

- Одна фаза — один PR в `develop-2.0`. Заголовок `Phase N: <название>`. Тело — блок RESULT из методологии (Implemented / Files / Migrations / Tests / Security / Known Issues / Rollback).
- Merge — только владельцем, после USER APPROVAL. Claude не мержит.
- Squash merge, чтобы история `develop-2.0` = список фаз.
- Миграции в PR — только forward; файл миграции, уже попавший в `develop-2.0`, не редактируется (CI проверяет хэши).

### 16.3. CI (GitHub Actions) — с Phase 1

Файл `.github/workflows/hona-core-ci.yml` лежит в корне репозитория: GitHub читает workflows только оттуда. Запуск — на `pull_request` в `develop-2.0` и `main` и на `push` в `develop-2.0`. Фильтр `paths` — только `hona-core/**` и сам файл workflow. Все шаги выполняются в `hona-core/`, кэш npm — по `hona-core/package-lock.json`, предыдущий запуск той же ветки отменяется. У легаси CI нет (папки `.github` сейчас не существует), поэтому его ничего не затрагивает.

| Job | Шаги | Блокирует merge |
| --- | --- | --- |
| `lint` | `npm ci` → ESLint (включая границы пакетов и запрет импорта из легаси) → `prettier --check` | да |
| `typecheck` | `tsc -b` по всем воркспейсам | да |
| `unit` | Vitest, проект unit | да |
| `integration` | service containers `postgres:16` и `redis:7`; MinIO запускается отдельным шагом `docker run`, потому что service container не принимает команду `server /data`. Далее роли БД, миграции с нуля и Vitest-проект integration: API, Database, RBAC, Isolation, Workflow, Concurrency | да |
| `migrations` | `drizzle-kit generate` → `git diff --exit-code` (схема и миграции совпадают); файлы миграций из базовой ветки не изменены | да |
| `build` | `vite build`, `tsc` для api и worker, размер начального бандла не больше 600 КБ gzip, `docker build` api/worker/web без push | да |
| `openapi` | генерация из zod → diff с `docs/api/openapi.json` | да |
| `secrets` | gitleaks CLI в контейнере по diff PR. Не `gitleaks-action`: для репозиториев организаций он требует лицензию | да |
| `deps` | `npm audit --audit-level=high` | предупреждение до Phase 22, затем блокирует |

Целевое время полного прогона — ≤ 8 минут. Кэш `node_modules` по хэшу lockfile.

### 16.4. CI — добавляется позже

| Job | Фаза | Что |
| --- | --- | --- |
| `e2e` | 6 | Playwright против поднятого compose-стека |
| `container` | 22 | `docker build` api/web/worker, `trivy` scan, push в GHCR с тегом `sha-<short>` |
| `security` | 22 | Semgrep (OWASP-правила для TS), `npm audit` блокирует |
| `migrate-check` | 22 | применить миграции PR поверх дампа схемы staging; любой `DROP`/`ALTER … TYPE` требует лейбла `destructive-migration-approved` |

### 16.5. CD — только после Phase 23

- `deploy-staging.yml`: вручную (`workflow_dispatch`) или по тегу `staging-*`. SSH на staging по ключу из Actions Secrets, затем `docker compose pull && up -d`, `migrate`, smoke (`/health/ready`, логин тестовым пользователем).
- `deploy-production.yml`: **только `workflow_dispatch` с обязательным environment approval** (GitHub Environments, reviewer — владелец). Никакого автодеплоя по push. Перед миграцией — `pg_dump` во внешнее хранилище и проверка, что дамп не пустой.
- **Миграции forward-only.** Они пишутся по схеме expand/contract: сначала добавить, через релиз убрать старое. Поэтому предыдущая версия кода работает с новой схемой, и откат — это `docker compose` на предыдущий тег образа без отката схемы.
- **Разрушающая миграция** (DROP, переименование, смена типа) требует лейбл `destructive-migration-approved`, свежий бэкап и отдельное подтверждение владельца. Её откат — восстановление из дампа. Процедура репетируется на staging в Phase 24.

### 16.6. Секреты в GitHub

Только Actions Secrets на уровне Environments (`staging`, `production`): SSH-ключ деплоя, адрес сервера, GHCR-токен. Адреса серверов не появляются в yml, README, RUNBOOK. Dependabot включён для npm и GitHub Actions, еженедельно, групповые PR.

## 17. Deployment Architecture (Future — Phase 23+)

Этот раздел — целевая картина, а не задача ближайших фаз. До Phase 23 система живёт только в GitHub и в CI. Старый сервер не используется и не восстанавливается.

### 17.1. Топология

```
                           Интернет
                              │ 443 / 80 (→ 301)
                        ┌─────┴─────┐
                        │   Caddy   │  TLS (Let's Encrypt), HSTS, заголовки, gzip/br
                        └┬────┬────┬┘
  <domain>/api/*, /api/v1/ws │    │    │ files.<domain> (Host сохраняется)
            ┌─────────────┘    │    └────────────┐
        ┌───┴───┐    <domain>/ │           ┌────┴───┐
        │  api  │       ┌─────┴────┐     │ minio  │  bucket hona — private
        │  ×2   │       │   web    │     │        │
        └───┬───┘       │  nginx   │     └────────┘
     ┌──────┼────────┐  └──────────┘
 ┌───┴────┐ ┌──┴───┐ ┌──┴─────┐
 │postgres│ │redis │ │ worker │  PG, Redis, MinIO, Telegram, SMTP
 └────────┘ └──────┘ └────────┘
     внутренняя docker-сеть, порты наружу не публикуются
```

Один сервер для staging, один для production. Оба — одинаковый `docker-compose.yml` + разные `.env`. На staging — те же образы по digest, что потом пойдут в production.

### 17.2. Сервер

| Параметр | Staging | Production |
| --- | --- | --- |
| CPU / RAM / диск | 2 vCPU / 4 ГБ / 60 ГБ SSD | 4 vCPU / 8 ГБ / 160 ГБ SSD |
| ОС | Ubuntu 24.04 LTS, автообновления security | то же |
| Доступ | SSH только по ключу ed25519, порт не 22, `PermitRootLogin no`, пользователь `deploy` с sudo без пароля только на docker | то же + fail2ban |
| Фаервол | ufw: 443, 80, SSH-порт; всё остальное deny; docker не обходит ufw (DOCKER-USER chain) | то же |
| Домен | `staging.<domain>`, `files.staging.<domain>` | `<domain>`, `files.<domain>` |

Ключ для нового сервера генерируется заново на машине владельца. На Windows перед этим ставится OpenSSH Client (выявлено в прошлой сессии как блокер доступа). Приватный ключ никогда не передаётся в чат и не коммитится.

### 17.3. Данные и бэкапы

- PostgreSQL 16, данные на named volume; `shared_buffers` 25 % RAM, `max_connections` 100, `log_min_duration_statement` 500 мс.
- **Бэкапы — вне сервера.** Ежедневно `pg_dump -Fc` + `mc mirror` MinIO-bucket → S3-совместимое хранилище у другого провайдера (шифрование `age` перед отправкой). Хранение: 30 ежедневных, 12 ежемесячных. Урок v1: бэкапы лежали на том же сервере и ушли вместе с ним.
- Еженедельный автотест восстановления: воркер на staging поднимает последний дамп в отдельную БД и считает `COUNT(*)` по ключевым таблицам; результат — в мониторинг.
- WAL-архивация / PITR — не в v1.0; допустимая потеря — до 24 ч (RPO). Решение владельца D-6.

### 17.4. Мониторинг и логи

| Что | Чем |
| --- | --- |
| Логи | pino JSON → stdout → docker json-file (rotate 100 МБ × 5); просмотр `docker compose logs`. Централизация (Loki) — позже |
| Метрики | `GET /metrics` (prom-client) только из docker-сети; Prometheus + Grafana в compose-профиле `monitoring` |
| Uptime | внешний чек `/health` каждые 60 с (UptimeRobot или аналог), алерт в Telegram владельцу |
| Алерты | outbox dead-letter > 0; `pending` старше 5 мин; 5xx > 1 %; диск > 80 %; бэкап не выполнен 26 ч |
| Ошибки фронта | `window.onerror` → `POST /client-errors` (rate-limited), без внешних SaaS |

### 17.5. Процедура релиза (production)

1. Тег `v2.x.y` на `main` → CI собирает образы, публикует в GHCR.
2. Тот же тег разворачивается на staging, прогоняется E2E против staging.
3. Владелец запускает `deploy-production` и подтверждает environment approval.
4. Скрипт: бэкап → `compose pull` → `migrate up` (только аддитивные миграции без лейбла) → `compose up -d api worker web` → smoke.
5. Откат — §16.5. Время простоя при релизе: 10–30 с (перезапуск api). Zero-downtime — не цель v1.0.

### 17.6. Что не делаем

- Kubernetes, managed PG, CDN — нет. Объёмы (десятки пользователей, тысячи задач) не требуют.
- Горизонтальное масштабирование на несколько серверов — нет, но архитектура (stateless api, Redis pub/sub, SKIP LOCKED) его не запрещает.

## 18. Development Plan (Phases 0–27)

### 18.1. Методология

Каждая фаза: PLAN → IMPLEMENT → TEST → AUDIT → REPORT → USER APPROVAL → NEXT. Перед фазой — блок STATUS, после — блок RESULT (формат задан владельцем). Статусы фаз: TODO / IN PROGRESS / TESTING / BLOCKED / DONE. Одна фаза = одна ветка = один PR. Никакой фазы без тестов и без одобрения предыдущей.

### 18.2. Статус на сегодня

|  |  |
| --- | --- |
| **DONE** | Phase 0 — Repository Audit & Architecture Freeze (закрыта 23.09.2026) |
| **CURRENT** | Git baseline: `main` и тег `v1-final` — ждёт утверждения владельца |
| **REMAINING** | Phases 1–27 |
| **BLOCKERS** | архитектурных нет. Предусловия Phase 1 в GitHub — §0: ветка `main`, три не влитых коммита v1 |
| **THIS PHASE** | аудит, классификация, архитектура, финальная проверка (§20), план Phase 1 (§23) |
| **NOT IN THIS PHASE** | код, миграции, зависимости, `develop-2.0`, CI-файлы, сервер |
| **ACCEPTANCE** | D-1…D-3 утверждены — выполнено; финальная проверка без блокеров — выполнено; владелец закрывает Phase 0 и отдельно разрешает Phase 1 |

### 18.3. Фазы

Колонка «Оценка» — рабочие сессии Claude Code (S) при среднем темпе; реальный срок зависит от скорости одобрений.

| # | Фаза | Содержание | Ключевой критерий приёмки | Зависит от | Оценка |
| --- | --- | --- | --- | --- | --- |
| 0 | Audit & Freeze | этот документ | approved | — | 1 S |
| 1 | Foundation | `hona-core/` на npm workspaces, Fastify-скелет с health, Drizzle и мигратор, схема `Env`, pino, `RequestContext`, `emit()` + outbox, скелет воркера, CI, dev-compose, дизайн-токены и базовые UI-примитивы. Детально — §23 | CI зелёный; `npm run dev` поднимает всё; легаси не изменён | D-1…D-3 (утверждены), предусловия §0 | 2 S |
| 2 | Auth | users, sessions, login/logout/logout-all, регистрация по коду, сброс пароля, rate limit, login\_history, страницы входа | тесты §14.1 включая инвалидацию сессий | 1 | 2 S |
| 3 | Company / Departments / Users / RBAC | companies, departments (дерево), members, `can()`, `authorize`, lint-правила, табличный RBAC-тест, тест изоляции, админ-страницы | матрица §8.3 зелёная | 2, R-1…R-3 | 2 S |
| 4 | Projects / Objects | projects, project\_members, архив, список и карточка проекта | видимость по ролям проверена | 3 | 1 S |
| 5 | Boards / Columns | boards, columns, WIP, reorder, kanban-вид без задач | DnD колонок работает | 4 | 1 S |
| 6 | Task Core | tasks, код через счётчик, position, `If-Match`, move, assignees, labels, список/фильтры, карточка на доске, первый E2E | concurrency-тест кодов зелёный; 409 работает | 5 | 3 S |
| 7 | Task Detail / Checklists / Subtasks | полная карточка, markdown, чеклисты, подзадачи, watchers, time entries, history | все поля §6.1 редактируемы | 6 | 2 S |
| 8 | Workflow / Acceptance / Review / Revision | workflows, statuses, transitions, `transitionTask`, кнопки по ролям, column↔status | таблица §7.2 покрыта тестами | 7, W-1, W-2 | 2 S |
| 9 | Task Chat / Comments / Mentions | comments, mentions, редактирование, удаление | упоминание создаёт событие | 7 | 1 S |
| 10 | Files / MinIO | §12 целиком, превью картинок | байты не проходят через api | 7 | 2 S |
| 11 | Realtime | §11 целиком, присутствие | E2E с двумя браузерами | 6, 9 | 2 S |
| 12 | My Day / My Tasks / Inbox | `/me/*`, экраны; перенос `analytics`: функции над `AnalyticsIndex` без изменений, новый сборщик индекса по таблицам | «Мой день» считается из analytics | 8 | 2 S |
| 13 | Calendar / Table / Timeline / Gantt / Dependencies | task\_dependencies, виды | цикл зависимостей отклоняется | 7 | 3 S |
| 14 | Notifications | §13: in-app, email, преференсы, дайджест, deadline-таймеры | recipients-таблица покрыта | 11 | 2 S |
| 15 | Telegram 2.0 | новый бот, привязка, доставка, inline-действия через сервисы | действие из TG проходит RBAC | 14 | 2 S |
| 16 | Templates / Recurring / Automations | task\_templates, recurring\_rules, простые автоматизации (если→то), смена workflow проекта | recurring создаёт задачи воркером | 8 | 2 S |
| 17 | Director Dashboard / Analytics | `/reports/*` на `packages/analytics`, кэш | цифры совпадают с ручным подсчётом на фикстуре | 8 | 2 S |
| 18 | HONA AI | перенос AI-слоя, новый ключ, факты из PG, RBAC-скоуп актора | AI не видит чужие задачи (тест) | 17 | 2 S |
| 19 | Security Hardening / TOTP / Recovery | TOTP, recovery codes, аудит-экран, hard delete, CSP-доводка | pentest-чеклист OWASP ASVS L1 пройден | 14 | 2 S |
| 20 | Integration Foundation | API-токены, webhooks наружу, SSO-заготовка | токен скоупится как актор | 19 | 1 S |
| 21 | Mobile / PWA | адаптив, offline-read, Web Push | Lighthouse PWA ≥ 90 | 14 | 2 S |
| 22 | Performance / Hardening | индексы по реальным планам, кэши, container/security CI, удаление старого кода, merge в `main`, тег `v1-final` | p95 API < 200 мс на 10k задач | 21 | 2 S |
| 23 | New Server Infrastructure | §17.2, compose prod, Caddy, бэкапы off-server, мониторинг, новые секреты | восстановление из бэкапа отрепетировано | 22, D-4, D-5 | 2 S + владелец |
| 24 | Staging | деплой, E2E против staging, репетиция отката | неделя без инцидентов | 23 | 1 S |
| 25 | Pilot | 1 департамент на staging 2 недели, сбор замечаний, правки | пилотная группа подтвердила | 24 | 2 S |
| 26 | Optional Legacy Import | только если найдётся дамп v1: парсер `board_state` → таблицы, `origin='migration'`, отчёт о потерях | отчёт одобрен владельцем | 25, наличие дампа | 2 S |
| 27 | Production Launch | деплой с approval, онбординг, неделя усиленного мониторинга | владелец объявил запуск | 25 (26) | 1 S |

Итого ≈ 50 сессий. Минимальный работающий продукт для пилота — Phases 1–12 + 14 + 23–24 (≈ 25 сессий); 13, 15–21 можно делать параллельно с пилотом, если владелец захочет раньше выйти на людей (решение D-7).

### 18.4. Пересечения с старым кодом

Старые `src/`, `api/`, `shared/` не удаляются до Phase 22. Пока они лежат рядом: новый код в `apps/`, `packages/`, `db/`; старый не собирается CI 2.0 и не импортируется новым. KEEP-модули копируются (не перемещаются) в своёй фазе вместе с тестами; оригинал остаётся до Phase 22 как справочник.

## 19. Risks & Unresolved Decisions

### 19.1. Риски

| # | Риск | Вероятность / влияние | Митигация |
| --- | --- | --- | --- |
| R-1 | Данные v1 утеряны: сервер отключён, бэкапы были на нём | высокая / среднее | архитектура не зависит от миграции; Phase 26 опциональна; владелец может спросить хостера о снапшоте диска |
| R-2 | Объём: 27 фаз, около 50 сессий; усталость от цикла одобрений | средняя / высокое | пилот после Phase 12 (D-7); фазы маленькие, с чёткими критериями приёмки |
| R-3 | Недооценка фронтенда: переход с boardStore на TanStack Query затрагивает почти все компоненты | высокая / среднее | ADAPT-компоненты копируются пофазно, каждый с новым хуком данных; легаси не трогается |
| R-4 | Drizzle: молодой инструмент, ломающие изменения между минорными версиями | средняя / низкое | версия запинена; repo-слой изолирует ORM; raw SQL разрешён (D-2) |
| R-5 | Data isolation без RLS | низкая / высокое | три рубежа: lint «ctx в repo», составные tenant-FK в PostgreSQL, генеративный тест в трёх вариантах; RLS — четвёртый рубеж в Phase 22, если тест хоть раз поймает утечку |
| R-6 | Один воркер — единая точка отказа для уведомлений и realtime | средняя / среднее | outbox не теряет события; `restart: always`; алерт на `pending` старше 5 мин; второй воркер — одна строка в compose |
| R-7 | Корпоративные прокси или мобильные сети режут WebSocket | низкая / среднее | деградация в refetch раз в 30 с (§11.5); проверить с реальных рабочих мест в Phase 24 |
| R-8 | Оптимистичные обновления и realtime дают «прыжки» карточек при медленной сети | средняя / низкое | свои события отбрасываются по `requestId`; кеш не принимает меньшую `version`; E2E с замедлением сети |
| R-9 | Вредоносные файлы без антивируса | низкая / среднее | allow-list типов, проверка сигнатуры, `attachment` для всего, кроме картинок; ClamAV — один шаг воркера, когда понадобится |
| R-10 | Секреты Anthropic, SMTP, Telegram нужно выпустить заново; без них Phases 14, 15, 18 не проверяются end-to-end | высокая / низкое | в CI — моки внешних API; настоящие ключи только на staging |
| R-11 | Старый Telegram-бот с утерянным токеном продолжает существовать | средняя / низкое | отозвать токен через @BotFather — действие владельца, можно сейчас |
| R-12 | Старый и новый код в одном репозитории до Phase 22 путают | низкая / низкое | 2.0 только в `hona-core/`; ESLint запрещает импорт из легаси; CI смотрит только `hona-core/**` |
| R-13 | Переименование статусов компанией ломает ожидания аналитики | низкая / низкое | аналитика работает по `category`, не по `key` и `name` |
| R-14 | Скрытая зависимость от корневого `node_modules` легаси: Node ищет пакеты вверх по дереву, и код 2.0 локально может работать на чужом пакете | средняя / низкое | CI ставит только зависимости `hona-core/`; правило ESLint `no-extraneous-dependencies` |
| R-15 | В репозитории нет `main`, три коммита v1 не влиты в ветку по умолчанию | факт / низкое | предусловия §0; до их выполнения `develop-2.0` создаётся от `25f9125` |
| R-16 | Счётчик кодов сериализует создание задач внутри компании | низкая / низкое | транзакция создания короткая; массовый импорт (Phase 26) резервирует диапазон одним UPDATE на N номеров |
| R-17 | drizzle-kit может не выразить часть ограничений: FK на генерируемую колонку, частичные уникальные индексы, триггеры | средняя / низкое | такие ограничения — в ручных SQL-миграциях (`drizzle-kit generate --custom`); DB-тест проверяет, что они есть и срабатывают |

### 19.2. Решения, которые должен принять владелец

**Нужны до Phase 1:**

| # | Вопрос | Решение |
| --- | --- | --- |
| D-1 | HTTP-фреймворк | **APPROVED 23.09.2026: Fastify** |
| D-2 | Слой БД | **APPROVED 23.09.2026: Drizzle + PostgreSQL, raw SQL разрешён** для аналитики, CTE, отчётов, возможностей PostgreSQL и горячих запросов |
| D-3 | Репозиторий | **APPROVED 23.09.2026: текущий репозиторий + `develop-2.0`**, код 2.0 в `hona-core/` |

**Нужны до Phase 3 / 8:**

| # | Вопрос | Рекомендация |
| --- | --- | --- |
| R-1 (§8.6) | EMPLOYEE видит все задачи проекта или только свои | все задачи проекта |
| R-2 (§8.6) | DEPARTMENT\_HEAD и кросс-департаментные проекты | только при членстве в проекте |
| R-3 (§8.6) | Нужен ли GUEST в v1.0 | оставить в списке ролей, не назначать до Phase 20 |
| W-1 (§7.6) | Статус ACCEPTED отдельный или слит с IN\_PROGRESS | отдельный, как в ТЗ |
| W-2 (§7.6) | Закрытие задачи без ответственного | **закрыт в Final**: ответственный обязателен, по умолчанию — создатель |

Ни один из этих вопросов не меняет схему БД: ответы меняют матрицу прав и данные workflow. Поэтому они не блокируют ни закрытие Phase 0, ни Phase 1.

**Нужны до Phase 23:**

| # | Вопрос | Рекомендация |
| --- | --- | --- |
| D-4 | Хостинг-провайдер и регион нового сервера; домен | тот же провайдер допустим, но бэкапы — у другого |
| D-5 | Куда класть off-server бэкапы (S3-совместимое хранилище) | любой S3-провайдер вне хостера сервера |
| D-6 | Допустимая потеря данных (RPO): 24 ч или нужен PITR | 24 ч для v1.0 |

**Можно отложить:**

| # | Вопрос | Рекомендация |
| --- | --- | --- |
| D-7 | Запуск пилота после Phase 12 (без Gantt, TG, AI) или после Phase 22 | после Phase 12 + 14 — раньше обратная связь |
| D-8 | Префикс кодов задач по умолчанию: `TASK` или по компании (`HONA`) | настраиваемый, дефолт `TASK` |
| D-9 | Нужны ли стикеры/фоны досок из v1 | нет в v1.0 |

### 19.3. Что заморожено этим документом

После закрытия Phase 0 следующие решения меняются только явным решением владельца и правкой этого документа:

- Fastify, Drizzle + PostgreSQL, `hona-core/` в текущем репозитории, `develop-2.0`.
- Иерархия сущностей (§5.1); одна сущность — одна таблица; Project ≠ Board; Column ≠ Workflow Status; задача не зависит от доски.
- UUID v7, `company_id` везде, составные tenant-FK, ни одного CASCADE.
- Счётчик кодов по компании; четыре роли участников задачи; подзадачи глубиной один уровень.
- Пять категорий статусов; статус меняет только серверный движок; список ролей.
- `If-Match` на мутациях, add/remove для наборов, `Idempotency-Key` на созданиях.
- Транзакционный outbox по обработчикам; «сокет уведомляет — REST отдаёт»; приватный bucket и presigned POST; серверные сессии.
- AI и внешние системы — только через прикладной слой и контракты (§22).
- Список фаз и их порядок.

Конкретные колонки, лимиты и имена эндпоинтов — рабочие детали. Они уточняются в фазах, изменения отражаются в этом документе.

## 20. Final Architecture Check

Все 16 пунктов проходят после правок Final. Что именно исправлено по каждому пункту — в колонке «Исправлено в Final»; сводка дефектов Draft — в §0. Ключевые решения по схеме и конкурентности проверены на PostgreSQL 16 (§20.2).

### 20.1. Пункты проверки

| # | Пункт | Вердикт | Что подтверждено | Исправлено в Final | Где |
| --- | --- | --- | --- | --- | --- |
| 1 | Database | PASS | Нет whole-board JSON. Все перечисленные сущности — отдельные таблицы. JSONB только в четырёх обоснованных местах: настройки уведомлений, `audit_log.details`, `domain_events.payload`, сохранённый ответ идемпотентности. Политика всех FK — `NO ACTION` | CASCADE убран; добавлен DDL `comments`; убраны `board_members` и дубль `head_user_id` | §5, §6, §10, §12, §21 |
| 2 | Task Code | PASS | UUID + `code` + `code_number`; счётчик на компанию под row lock; `UNIQUE (company_id, code)` | утверждение «дыры при откате» было неверным — дыр нет | §6.2 |
| 3 | Project / Board / Column / Workflow | PASS | Project ≠ Board (0..N досок), Column ≠ Status (`maps_to_status_id` необязателен), статус — доменный | задача больше не обязана быть на доске | §5.3, §6.1, §7.4 |
| 4 | Responsible / Executors / Watchers | PASS | четыре роли хранятся раздельно и не смешиваются в один массив | `task_assignees` → `task_executors`; ответственный обязателен | §6.1 |
| 5 | Subtasks | PASS | связь с родителем, глубина и циклы — на FK; права, архив, завершение, зависимости описаны | глубина была только правилом в коде | §6.7 |
| 6 | Workflow | PASS | 10 переходов, у каждого авторизация; статус меняет только сервер; `allowedActions` считает сервер | переходы без проверки версии; добавлен `withdraw_review` | §7 |
| 7 | RBAC | PASS | сервер — единственный источник решения; матрица по девяти областям; подстановка ID даёт `404` | чужой проект в своей компании и ID в теле запроса не были покрыты | §8.4, §8.5, §15.5 |
| 8 | Concurrency | PASS | `version` на всех изменяемых сущностях, `If-Match` обязателен, `409` с текущим состоянием, поведение клиента описано | PUT-замена списков и перенос без версии давали last-write-wins | §6.5, §9 |
| 9 | Domain Events + Outbox | PASS | одна транзакция; retry, идемпотентность, dead-letter, метрики; внешние каналы не влияют на бизнес-транзакцию | один статус на всех обработчиков → строка на обработчик | §10 |
| 10 | Realtime | PASS | аутентификация и Origin при upgrade, авторизация каждой подписки, Redis pub/sub, reconnect, пропуски, порядок, дубли | перепроверка подписок при смене прав и отзыве сессии | §11 |
| 11 | Files | PASS | приватный bucket; цепочка intent → presigned → upload → finalize → metadata; лимиты, проверка типа, ключи, сироты, авторизация скачивания | `/s3/*` ломал подпись; presigned PUT не ограничивал размер | §12 |
| 12 | Authentication & Sessions | PASS | серверные сессии, HttpOnly + Secure + SameSite, срок, отзыв, scrypt, rate limit, CSRF, аудит входа; TOTP и recovery codes — обязательная Phase 19 | префикс `__Host-`, явный `maxmem`, ротация токена | §14 |
| 13 | Delete Policy | PASS | жизненный цикл восьми сущностей, архив вместо удаления | раздела не было | §21 |
| 14 | Audit | PASS | `audit_log` без FK и только с INSERT/SELECT; `domain_events` и `task_status_history` хранятся бессрочно и переживают архив | — | §14.5, §21 |
| 15 | AI | PASS | только через прикладной слой с правами пользователя; запись — parse → preview → подтверждение → обычная команда | раздела не было | §22 |
| 16 | Integration Boundary | PASS | ORDER, Stock, Attendance, AVR — только API, события и контракты, без доступа к таблицам | раздела не было | §22 |

### 20.2. Проверено на PostgreSQL 16

Полный DDL этого документа (§5.3, §6.1, §6.3, §9.1, §10.2, §12.2) применён к PostgreSQL 16.13 в одноразовом локальном кластере сессии, без репозитория и без production. Результат: 32 таблицы, 64 внешних ключа, 0 с CASCADE. Это доказательства решений, а не тесты продукта: в фазах они станут автоматическими тестами §15.

| Проверка | Результат |
| --- | --- |
| Задача без доски; полная цепочка компания → проект → доска → колонка → задача → подзадача | приняты |
| Задача компании A в проекте компании B | отклонена FK |
| Доска чужого проекта; колонка чужой доски; доска без колонки | отклонены FK и CHECK |
| Подзадача подзадачи; подзадача в другом проекте; задача с подзадачами становится подзадачей; сама себе родитель | все отклонены |
| Удаление задачи с подзадачами, проекта с задачами, колонки с задачами | отклонено, ничего не удалено каскадом |
| Исполнитель, не состоящий в компании | отклонён FK |
| Задача без ответственного / импортированная задача без создателя | первая отклонена CHECK, вторая принята (`origin = 'migration'`) |
| 200 параллельных созданий задач, 8 из них откатываются | 192 уникальных кода, 0 пропусков |
| Гонка зависимостей A→B и B→A без блокировки | цикл создан — дефект Draft подтверждён |
| Та же гонка с advisory-блокировкой на компанию | второй запрос отклонён, цикла нет |
| Два параллельных запроса с одним `Idempotency-Key` | одно исполнение, второй получил сохранённый ответ |

## 21. Lifecycle & Delete Policy

Исторически важные данные не исчезают случайно: ни один FK не каскадный, и удаление родителя с детьми отклоняет сам PostgreSQL. Обычный путь — архив. Физическое удаление — только явной admin-процедурой с записью в аудит и отдельным подтверждением.

### 21.1. Политика связей

| Тип связи | Политика | Пример |
| --- | --- | --- |
| Любой FK | `NO ACTION`: удалить родителя с детьми нельзя | `tasks` → `projects`, `comments` → `tasks` |
| Журналы | без FK на сущности, поэтому переживают любой архив и удаление | `domain_events`, `audit_log` |
| Связи без собственной истории | удаляются одной командой сервиса; факт остаётся в `domain_events` | `task_watchers`, `task_labels`, `project_members` |
| Физическое удаление | только SUPER\_ADMIN, admin-процедура удаляет детей в явном порядке и пишет `audit_log` | `task.hard_deleted` (Phase 19) |

### 21.2. Жизненный цикл сущностей

| Сущность | Обычное «удаление» | Дети | Восстановление | Физическое удаление |
| --- | --- | --- | --- | --- |
| Company | не удаляется; `status = 'suspended'` блокирует вход всем участникам | всё сохраняется | `status = 'active'` | вне v1.0; только офлайн-процедура с экспортом и бэкапом по отдельному решению |
| Department | `archived_at`; с активными дочерними департаментами или проектами → `422` | люди остаются в компании | да | нет |
| Project | `archived_at`; проект становится только для чтения и уходит из активных видов | доски, задачи, файлы сохраняются и по отдельности не архивируются | да, возвращается всё | SUPER\_ADMIN, проект в архиве не меньше 30 дней, admin-процедура; журналы остаются |
| Board | `archived_at` | задачи остаются в проекте и видны в таблице, календаре, списках | да | нет |
| Column | физическое удаление только пустой колонки; UI предлагает перенести задачи | FK не даст удалить колонку с задачами | — | да, если пустая: исторической ценности нет |
| Task | `archived_at` + `archive_reason` | подзадачи архивируются с `parent_archived`; чеклисты, комментарии, файлы, история сохраняются | да; возвращаются только подзадачи с `parent_archived` | SUPER\_ADMIN, admin-процедура |
| Comment | `deleted_at` + `deleted_by`; в интерфейсе «Комментарий удалён»; текст и прошлые версии остаются в БД | упоминания и привязанные файлы сохраняются | SUPER\_ADMIN | очистка текста — политика хранения, Phase 19 |
| Attachment | `status = 'deleted'`, привязки получают `unlinked_at` | — | да, 30 дней | байты удаляет воркер через 30 дней; строка `files` остаётся со `status = 'purged'` |
| User | не удаляется; деактивация: `is_active = false`, все сессии отозваны, членство закрыто | задачи, комментарии и история сохраняют ссылку, интерфейс показывает «бывший сотрудник»; открытые задачи, где он ответственный, предлагаются к переназначению | да, реактивация | нет; анонимизация персональных данных — решение Phase 19 |

### 21.3. Хранение истории

| Данные | Срок | Защита |
| --- | --- | --- |
| `audit_log`: актор, действие, тип и id сущности, время, IP, `details` с `requestId` | бессрочно | без FK; роль `hona_app` имеет только INSERT и SELECT, UPDATE и DELETE отозваны |
| `domain_events`, `task_status_history` | бессрочно | архив сущности их не затрагивает; сервисы только дописывают |
| `login_history` | 90 дней | очистка воркером |
| Прочитанные `notifications` | 90 дней | непрочитанные не удаляются |
| `outbox` со статусом `done` | 24 ч | событие остаётся в `domain_events` |

## 22. AI & Integration Boundary

AI и внешние системы работают с HONA Core только через прикладной слой с тем же `authorize`, что и люди. Прямого доступа к PostgreSQL нет ни у одного из них.

### 22.1. HONA AI (Phase 18)

AI — не отдельный пользователь со своими правами, а инструмент, который действует от имени конкретного человека. Его Actor — это пользователь с `via: 'ai'`.

- **Чтение.** Инструменты AI вызывают те же сервисы с `visibilityFilter` этого пользователя. Ни сырого SQL, ни отдельной роли БД, ни сервисного аккаунта у AI нет. В модель уходит только то, что пользователь вправе видеть.
- **Запись — четыре шага:**
  1. **Parse.** Модель превращает текст в черновик команды — zod-DTO того же контракта, что у REST. Ничего не записывается.
  2. **Preview.** Сервер валидирует черновик и выполняет `authorize` без записи. Пользователь видит, что именно изменится.
  3. **Human confirmation.** Явное действие человека. Черновик хранится 15 минут и сверяется по хешу: подтверждается ровно то, что показано.
  4. **Command.** Подтверждённый черновик исполняет обычный сервис с `authorize`, `If-Match` и событиями. В `domain_events` пишется `via = 'ai'`.
- **AI не может:** подтвердить свой черновик; сделать то, чего не может пользователь; менять роли, участников, workflow или что-либо удалять.
- **Prompt injection.** Текст задач и комментариев — данные, а не инструкции. Даже если модель поддастся, любая запись всё равно требует подтверждения человека.
- **Наследие v1.** Слой facts → analytics → agents и проверка evidence (KEEP) переносятся в Phase 18.
- **Контроль.** Выключатель AI на уровне компании, суточный лимит запросов и токенов, идентификатор модели и новый API-ключ — из env.

### 22.2. Внешние системы: HONA ORDER, Stock, Attendance, AVR (Phase 20)

Ни одна из этих систем не подключается к таблицам HONA Core. У них нет учётных записей БД, общих схем и общих FK; PostgreSQL наружу не открыт.

| Канал | Как устроен |
| --- | --- |
| Входящий | версионированный REST `/api/v1` по OpenAPI-контракту (§9.1). API-токен интеграции — это актор с ограниченным набором прав и проектов, он проходит тот же `authorize`. Токен хранится как хеш, ротируется и отзывается, его использование аудируется |
| Исходящий | обработчик outbox `webhooks`: подпись HMAC, повторы и dead-letter как у остальных обработчиков (§10) |
| Контракт событий | публичная версия событий в `packages/shared/contracts/integration/v1`, а не внутренняя структура таблиц |
| Версии | несовместимое изменение — новая версия контракта; старая работает переходный период |
| Связь сущностей | через внешние идентификаторы: `external_refs (company_id, system, external_id, entity_type, entity_id)`, а не общие ключи |

Пример: HONA ORDER создаёт задачу вызовом `POST /api/v1/tasks` со своим токеном, а HONA Core сообщает в ORDER о завершении вебхуком `task.completed`.

## 23. Phase 1 — Foundation: план

Phase 1 создаёт пустой, но полностью рабочий каркас 2.0 в `hona-core/`. Сервер отвечает на health, миграции применяются, тестовое событие проходит путь `emit` → outbox → воркер, CI зелёный. Бизнес-таблиц, бизнес-эндпоинтов и изменений легаси нет. **Это план: реализация начинается только по отдельному разрешению владельца.**

### 23.1. STATUS

|  |  |
| --- | --- |
| **DONE** | Phase 0 (после закрытия владельцем) |
| **CURRENT** | Phase 1 — Foundation (после разрешения) |
| **REMAINING** | Phases 2–27 |
| **BLOCKERS** | нет. Предусловия §0 желательны, запасной вариант — `develop-2.0` от `25f9125` |
| **THIS PHASE** | каркас, конфигурация, логирование, health, миграции, `emit` + outbox, скелет воркера, тестовая инфраструктура, CI, dev Docker, оболочка веба |
| **NOT IN THIS PHASE** | §23.12 |
| **ACCEPTANCE** | §23.11 |

### 23.2. Порядок работы

1. С разрешения владельца создать `develop-2.0` от `main` или, пока `main` нет, от `25f9125`.
2. Работать в ветке сессии; один PR в `develop-2.0` с блоком RESULT.
3. После первого зелёного прогона владелец включает защиту `develop-2.0` и required checks: имена jobs появляются в GitHub только после первого запуска.
4. Merge делает владелец.

### 23.3. Файлы, которые будут созданы

```
.eslintignore                        «hona-core/» — легаси `eslint .` не трогает 2.0
.github/workflows/hona-core-ci.yml   CI §23.10
.github/dependabot.yml               npm /hona-core + github-actions, target develop-2.0
hona-core/
├─ package.json                      workspaces; scripts dev, build, lint, typecheck, test, db:generate, db:migrate
├─ package-lock.json  .nvmrc (22)  .gitignore  .env.example  .prettierrc
├─ tsconfig.base.json                strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├─ eslint.config.js                  typescript-eslint, границы пакетов, запрет импорта легаси
├─ vitest.workspace.ts               проекты unit и integration
├─ docker-compose.dev.yml            postgres, redis, minio, minio-init
├─ README.md
├─ apps/
│  ├─ api/        package.json  tsconfig.json  Dockerfile
│  │  └─ src/     server.ts  app.ts
│  │             core/config/env.ts  core/logger.ts  core/errors.ts  core/context.ts
│  │             core/db.ts  core/tx.ts  core/redis.ts  core/s3.ts
│  │             core/events/emit.ts  core/events/handlers.ts
│  │             plugins/security.ts  modules/health/routes.ts  **/*.test.ts
│  ├─ worker/     package.json  tsconfig.json  Dockerfile
│  │  └─ src/     main.ts  health.ts  outbox/claim.ts  outbox/dispatch.ts  outbox/retry.ts
│  │             outbox/sweeper.ts  handlers/noop.ts  **/*.test.ts
│  └─ web/        package.json  tsconfig.json  vite.config.ts  tailwind.config.ts  index.html  Dockerfile
│     └─ src/     main.tsx  app/App.tsx  app/providers.tsx  app/router.tsx
│                api/client.ts  lib/cn.ts  pages/Status.tsx
│                components/ui/  Button IconButton Badge Checkbox Toggle ProgressBar Logo Drawer Menu
├─ packages/
│  ├─ shared/     src/contracts/health.ts  src/errors.ts  src/events/index.ts  src/events/system.ts  src/ids.ts
│  └─ db/         drizzle.config.ts
│                src/schema/events.ts  src/schema/index.ts  src/client.ts  src/migrate.ts
│                migrations/0000_foundation.sql  migrations/meta/
│                init/01-roles.sh
│                tests/migrations.test.ts  tests/drift.test.ts  tests/no-cascade.test.ts  tests/roles.test.ts
└─ docs/         adr/0001-fastify.md  adr/0002-drizzle-postgresql.md  adr/0003-repository-strategy.md
                 development.md  api/openapi.json
```

Из легаси копируются только: девять UI-примитивов из `src/components/ui`, зависящих только от `cn`; функция `cn` из `src/lib/utils.ts`; дизайн-токены из `tailwind.config.ts` и `src/index.css`. `Avatar` и `Priority` зависят от легаси-типов и переносятся в Phases 3 и 6.

### 23.4. Что остаётся нетронутым

Все существующие файлы репозитория: `src/`, `api/`, `shared/`, `tests/`, `docs/`, `deploy/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.cjs`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore`, `.gitignore`, `README.md`. В корне добавляются только три новых файла из §23.3, и ни один существующий не редактируется. Корневой `.gitignore` уже игнорирует `node_modules`, `dist` и `.env*` на любой глубине.

### 23.5. Зависимости

Указаны мажорные версии; точные зафиксирует lockfile при установке.

| Где | Runtime | Dev |
| --- | --- | --- |
| `hona-core` (корень) | — | typescript 5, @types/node 22, eslint 9, typescript-eslint 8, eslint-plugin-import-x, prettier 3, vitest, @vitest/coverage-v8, tsx |
| `apps/api` | fastify 5, fastify-type-provider-zod, @fastify/helmet, @fastify/swagger, zod, pg, drizzle-orm, ioredis, @aws-sdk/client-s3, uuidv7, close-with-grace | pino-pretty |
| `apps/worker` | pg, drizzle-orm, ioredis, pino, zod | pino-pretty |
| `apps/web` | react 18, react-dom, react-router-dom 6, @tanstack/react-query 5, lucide-react, clsx, tailwind-merge | vite 5, @vitejs/plugin-react, tailwindcss 3.4, postcss, autoprefixer, @testing-library/react, jsdom |
| `packages/db` | drizzle-orm, pg | drizzle-kit |
| `packages/shared` | zod | — |

Не ставятся в Phase 1: @fastify/cookie и @fastify/rate-limit (Phase 2), @aws-sdk/s3-presigned-post (Phase 10), @fastify/websocket (Phase 11), @playwright/test (Phase 6), nodemailer (Phase 2), @anthropic-ai/sdk (Phase 18), otplib (Phase 19).

### 23.6. Docker

| Сервис dev-compose | Образ | Порт на хосте | Назначение |
| --- | --- | --- | --- |
| postgres | `postgres:16-alpine` | `127.0.0.1:5433` | БД; init-скрипт создаёт роли `hona_app`, `hona_migrate`, `hona_readonly` с паролями из переменных контейнера |
| redis | `redis:7-alpine` | `127.0.0.1:6380` | pub/sub и счётчики; в Phase 1 — только readiness |
| minio | `minio/minio`, закреплённый релиз | `127.0.0.1:9000`, консоль `127.0.0.1:9001` | S3 |
| minio-init | `minio/mc` | — | создать bucket `hona`, anonymous `none`, CORS на `APP_ORIGIN` |

Порты привязаны только к `127.0.0.1` и не пересекаются с легаси-compose. api, worker и web в dev запускаются на хосте через `npm run dev` с hot reload. Dockerfile для api и worker — multi-stage на `node:22-alpine`, non-root, healthcheck на Node без curl. Dockerfile для web — статика в `nginx:alpine`. Образы собираются в CI и никуда не публикуются. Production-compose и Caddy — Phase 23.

### 23.7. Механизм миграций

1. Схема описывается на TypeScript в `packages/db/src/schema/*.ts` (Drizzle).
2. `npm run db:generate` запускает drizzle-kit и создаёт SQL-файл в `packages/db/migrations/` с журналом. Этот SQL читается на ревью.
3. То, что drizzle-kit не выражает (расширения, функции, триггеры, частичные индексы с выражениями, GRANT), пишется ручной SQL-миграцией `drizzle-kit generate --custom` в той же последовательности (риск R-17).
4. `npm run db:migrate` запускает `packages/db/src/migrate.ts`. Он подключается под `hona_migrate`, берёт `pg_advisory_lock` против двух параллельных запусков, ставит `lock_timeout = 5s` и применяет миграции через migrator Drizzle.
5. Миграции forward-only; применённый файл не редактируется, это проверяет CI.
6. Миграция Phase 1 — `0000_foundation`: расширение `citext`, функция `set_updated_at()`, таблицы `domain_events`, `outbox`, `outbox_dead_letter` (§10.2) и GRANT для `hona_app`. Бизнес-таблицы появляются в своих фазах.
7. Роли — объекты уровня кластера, поэтому они не в миграциях: в dev и CI их создаёт `init/01-roles.sh`, в production — runbook Phase 23.

### 23.8. Тестовая основа

Инфраструктура: Vitest-воркспейс с проектами unit и integration; база-шаблон и база на каждый воркер (§15.3); `buildApp(config)` для `app.inject()`; `ctx.now()` для времени.

| Группа | Тесты Phase 1 |
| --- | --- |
| Unit | схема `Env`: валидная, неполная, значения секретов не попадают в текст ошибки; соответствие кодов ошибок HTTP-статусам; монотонность UUID v7; redact логгера |
| API | `/health` → 200 без авторизации; `/health/ready` → 200, и 503 при недоступной зависимости; неизвестный маршрут → 404 в формате §9.2 с `requestId`; `x-request-id` в ответе; заголовки безопасности; тело больше 1 МБ → 413; мутация с чужим `Origin` → 403 |
| Database | миграции с нуля; повторный запуск ничего не меняет; drift чистый; 0 FK с CASCADE; `hona_app` не может выполнять DDL |
| Events | `emit` пишет событие и строки outbox в одной транзакции; откат не оставляет ничего; невалидный payload → исключение и откат; NOTIFY приходит только после COMMIT |
| Worker | два воркера не берут одну строку; backoff с разбросом; dead-letter на 12-й попытке; зависший `processing` возвращается; ошибка одного обработчика не затрагивает другой |
| Web | оболочка рендерится; экран состояния показывает ответ health (fetch замокан) |

Покрытие `apps/api/src/core` и `apps/worker/src/outbox` — не меньше 90 % строк.

### 23.9. Логирование, конфигурация, health

| Что | Решение |
| --- | --- |
| Логи | pino, JSON в stdout; поля `time`, `level`, `msg`, `requestId`, `route`, `statusCode`, `responseTimeMs`, с Phase 2 ещё `userId` и `companyId`. В dev — pino-pretty. Уровень — `LOG_LEVEL` |
| Redact | `headers.cookie`, `headers.authorization`, `set-cookie`, `*.password`, `*.token`, `*.secret`. Тела запросов не логируются |
| Request ID | `x-request-id` от прокси принимается, только если формат валиден; иначе генерируется. Всегда возвращается в ответе и пишется в события |
| Конфигурация | единственное место чтения `process.env` — `core/config/env.ts` (zod), остальное запрещено lint. Неполное окружение → процесс не стартует и печатает имена переменных без значений. Конфиг заморожен и передаётся в `buildApp(config)` |
| Переменные Phase 1 | `NODE_ENV`, `HOST`, `PORT`, `APP_ORIGIN`, `LOG_LEVEL`, `TRUST_PROXY`, `DATABASE_URL`, `DATABASE_URL_MIGRATE`, `REDIS_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `WORKER_ID`. `.env.example` — только имена и примеры формата; `.env` никогда не `source`-ится скриптами |
| `GET /api/v1/health` | liveness: процесс жив; без зависимостей и авторизации; `{ status, version, uptimeS }` |
| `GET /api/v1/health/ready` | readiness: `SELECT 1` с таймаутом 1 с, Redis `PING`, MinIO `HeadBucket`; 200 или 503; наружу только общий статус, детали — в лог |
| Worker health | HTTP `/health` на внутреннем порту: последний цикл не старше 30 с, соединение с PostgreSQL есть |
| Graceful shutdown | по SIGTERM API перестаёт принимать запросы и дожидается текущих; воркер заканчивает пачку; затем закрываются PostgreSQL и Redis |

### 23.10. GitHub Actions

В Phase 1 создаётся весь набор jobs из §16.3: lint, typecheck, unit, integration, migrations, build, openapi, secrets, deps. У workflow только `permissions: contents: read`, секреты GitHub ему не нужны: пароли тестовой БД — локальные константы CI. Actions закреплены по версии. Dependabot открывает групповые PR раз в неделю в `develop-2.0`.

### 23.11. Критерии приёмки

1. В PR в `develop-2.0` все jobs CI зелёные.
2. Локально `docker compose -f docker-compose.dev.yml up -d`, `npm ci`, `npm run db:migrate`, `npm run dev` поднимают api, worker и web; экран состояния показывает «ok».
3. `/health` отвечает 200, `/health/ready` — 200, а при остановленном PostgreSQL — 503.
4. Тестовое событие `system.ping` проходит `emit` → outbox → воркер → noop-обработчик; все тесты §23.8 зелёные.
5. Миграции применяются с нуля, drift чистый, FK с CASCADE нет.
6. Легаси не изменён: diff PR содержит только `hona-core/**`, `.github/**` и `.eslintignore`. Легаси `npm run lint`, `npm run typecheck` и `npm run build` проходят так же, как до PR.
7. Секретов в репозитории нет: gitleaks чистый, в `.env.example` нет значений, IP-адресов и имён серверов нет.
8. Описание PR содержит блок RESULT.

Оценка — 2 сессии.

### 23.12. Не входит в Phase 1

- Аутентификация, пользователи, компании, RBAC и любые бизнес-таблицы и экраны.
- Перенос `analytics` (Phase 12), `Avatar` и `Priority` (Phases 3 и 6).
- Production-compose, Caddy, сервер, деплой, секреты production.
- Любые изменения легаси-файлов.

---

**PHASE 0: DONE** — архитектура v1.0 Final утверждена 23.09.2026. Следующий шаг — Git baseline, затем Phase 1 по отдельному разрешению.
