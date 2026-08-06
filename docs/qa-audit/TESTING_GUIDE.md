# Как запускать тесты

Тесты не требуют дополнительных зависимостей: раннер — встроенный в Node
`node:test`, типы снимаются флагом `--experimental-strip-types`.
**Нужен Node 22.6 или новее** (`node --version`).

## Команды

| Что | Команда | Время |
|---|---|---|
| Логика приложения (36 тестов) | `npm run test:unit` | ~1 с |
| Серверные защиты (26 тестов) | `npm run test:api` | ~1 с |
| Оба набора | `npm test` | ~2 с |
| Сценарии в браузере (44 проверки) | `npm run test:e2e` | ~40 с |
| Линтер | `npm run lint` | |
| Типы | `npm run typecheck` | |
| **Всё перед релизом** | `npm run verify` | ~1 мин |

`npm run verify` = линтер + типы + unit + api + production-сборка.
E2E запускается отдельно, потому что требует собранный `dist` и браузер.

## E2E: что нужно

E2E работают поверх собранного приложения, реальный сервер и база **не нужны** —
ответы API подставляются в браузере.

```bash
npm run build      # обязательно: E2E проверяют содержимое dist
npm run test:e2e
```

Playwright ищется в таком порядке: `node_modules` проекта → переменная
`PLAYWRIGHT_PATH` → системная установка. Если не найден:

```bash
npm i -D playwright
npx playwright install chromium
```

Другой браузер: `BROWSER=firefox npm run test:e2e` (нужен
`npx playwright install firefox webkit`).

## Где что лежит

```
tests/
  alias-hook.mjs     — резолвер «@/…» и расширений для node:test
  alias-resolver.mjs
  unit/logic.test.ts — коды задач, статусы списков, сроки, чек-листы, фильтры
  api/guards.test.ts — проверка состояния доски, снимки истории, лимит входа
  e2e/harness.mjs    — статический сервер, подстановка API, запуск браузера
  e2e/run.mjs        — пользовательские сценарии
```

## Как добавить свой тест

Логика (чистые функции) — в `tests/unit/logic.test.ts`:

```ts
test('название проверки', () => {
  assert.equal(myFunction('вход'), 'ожидаемое')
})
```

Сценарий в браузере — в `tests/e2e/run.mjs`, внутри `try`:

```js
r.section('Мой раздел')
await page.getByText('Кнопка').click()
r.check(await page.getByText('Результат').isVisible(), 'описание проверки')
```

Правило: тест сначала должен **упасть** на текущем коде — иначе он ничего не
проверяет. Именно так были подтверждены дефекты B-02 и B-03.

## Восстановление доски из снимка

Перед перезаписью сервер сохраняет предыдущее состояние в `board_history`
(последние 50 снимков; при потере более 20% карточек снимок делается обязательно).

Посмотреть снимки:

```bash
docker compose exec postgres psql -U ithona -d ithona -c \
  "SELECT id, created_at, cards, actor FROM board_history ORDER BY created_at DESC LIMIT 20;"
```

Восстановить конкретный снимок (**сначала сделайте резервную копию базы**,
см. `deploy/backup.sh`):

```bash
docker compose exec postgres psql -U ithona -d ithona -c \
  "UPDATE board_state SET data = (SELECT data FROM board_history WHERE id = <ID>), updated_at = now() WHERE id = 'default';"
```

После восстановления пользователям нужно перезагрузить страницу (Ctrl+Shift+R):
у открытых вкладок в памяти остаётся прежнее состояние, и автосохранение может
записать его обратно.

## Ручные проверки

Сценарии, которые нельзя автоматизировать в этой среде (реальная база, роли,
Telegram, мобильные устройства), описаны в `TEST_CASES.md`.
Короткий список после любого изменения — `REGRESSION_CHECKLIST.md`.
