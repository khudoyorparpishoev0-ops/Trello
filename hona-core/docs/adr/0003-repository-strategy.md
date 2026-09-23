# ADR 0003 — Репозиторий: текущий репозиторий, `hona-core/`, ветка `develop-2.0`

- **Статус:** принято владельцем 23.09.2026 (решение D-3, Architecture v1.0 Final §0, §4, §16).
- **Реализация:** Phase 1 — workspace `hona-core/`, CI `.github/workflows/hona-core-ci.yml`.

## Контекст

В корне репозитория уже есть легаси v1: `src/`, `api/`, `shared/`, `tests/`, `docs/`, `deploy/`,
`package.json`. Его `npm run lint` запускает `eslint .` по всему дереву.

## Решение

- Новый репозиторий не создаётся. Весь код 2.0 — в изолированной папке **`hona-core/`**: свой
  `package.json` (npm workspaces), lockfile, tsconfig, ESLint 9, Vitest.
- Легаси не удаляется, не правится и не импортируется: ESLint запрещает алиасы v1, тест-страж
  проверяет, что относительные импорты не выходят за пределы своего пакета и `hona-core/`.
- В корень добавлены только три файла: `.eslintignore` (`hona-core/` — чтобы `eslint .` легаси
  не линтил 2.0), `.github/workflows/hona-core-ci.yml`, `.github/dependabot.yml`.
- Ветки: `main` — стабильный v1 (тег `v1-final`); `develop-2.0` — интеграционная ветка 2.0;
  одна фаза — один PR в `develop-2.0`. Merge делает владелец (§16.2).

## Последствия

- CI устанавливает только зависимости `hona-core/` и срабатывает только на `hona-core/**`
  и файл workflow; легаси им не собирается.
- PR фазы проверяется на то, что diff не выходит за `hona-core/**`, `.github/**`, `.eslintignore`.
- Слияние `develop-2.0` в `main` и удаление легаси — Phase 22, отдельным решением владельца.
