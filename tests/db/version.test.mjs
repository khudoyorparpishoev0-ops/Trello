/**
 * Интеграционная проверка версионирования доски на настоящем PostgreSQL.
 * Запуск: npm run test:db (нужна поднятая база).
 *
 * Модульные тесты покрывают решение о конфликте (`boardGuard.js`), e2e —
 * поведение интерфейса. Здесь проверяется то, что не видно ни там, ни там:
 * SQL, рост номера версии и гонка двух одновременных записей.
 *
 * Без доступной базы тест не падает, а сообщает, что пропущен: на машине без
 * PostgreSQL это не дефект кода.
 */
import { spawn } from 'node:child_process'
import pg from 'pg'

const PORT = process.env.TEST_API_PORT ?? '3999'
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://ithona:test@127.0.0.1:5432/ithona_test'
const BASE = `http://127.0.0.1:${PORT}/api/board`

const pool = new pg.Pool({ connectionString: DB, connectionTimeoutMillis: 2000 })
try {
  await pool.query('SELECT 1')
} catch (e) {
  console.log(`⊘ Пропущено: база недоступна (${DB}) — ${e.message}`)
  await pool.end().catch(() => {})
  process.exit(0)
}

// Чистый старт: схему создаст сам сервер.
await pool.query('DROP TABLE IF EXISTS board_state, board_history CASCADE')

const api = spawn('node', ['api/server.js'], {
  cwd: new URL('../..', import.meta.url).pathname,
  env: {
    ...process.env,
    PORT,
    DATABASE_URL: DB,
    // Заведомо закрытый порт: Redis здесь не нужен, сервер работает без него.
    REDIS_URL: 'redis://127.0.0.1:65534',
    AUTH_PASSWORD: '',
    INVITE_CODE: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

const ready = await new Promise((resolve) => {
  const t = setTimeout(() => resolve(false), 15000)
  api.stdout.on('data', (d) => {
    if (String(d).includes('слушает')) {
      clearTimeout(t)
      setTimeout(() => resolve(true), 500)
    }
  })
})
if (!ready) {
  console.log('✗ API не стартовал')
  api.kill()
  await pool.end()
  process.exit(1)
}

const board = (name) => ({
  workspace: { id: 'w1', name: 'IT-HONA', boards: [{ id: 'b1', name }] },
  users: {},
  currentUserId: 'u1',
  boards: { b1: { id: 'b1', name, visibility: 'private', listIds: [], memberIds: [] } },
  boardOrder: ['b1'],
  activeBoardId: 'b1',
  lists: {},
  cards: {},
  labels: {},
  departments: [],
})

const put = (name, version) =>
  fetch(BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(version === null ? {} : { 'X-Board-Version': String(version) }),
    },
    body: JSON.stringify(board(name)),
  })

let failed = 0
const check = (ok, label) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label)
  if (!ok) failed++
}

console.log('\n▸ Версионирование доски · PostgreSQL')

let r = await put('Первая', null)
check(r.status === 200, 'первая запись проходит (версии ещё нет)')
check((await r.json()).version === 1, 'ей присвоена версия 1')

r = await fetch(BASE)
check(r.headers.get('x-board-version') === '1', 'GET отдаёт X-Board-Version: 1')
check((await r.json()).boards.b1.name === 'Первая', 'GET отдаёт состояние доски')

r = await put('Вторая', 1)
check(r.status === 200, 'запись с актуальной версией проходит')
check((await r.json()).version === 2, 'версия выросла до 2')

r = await put('Затирающая', 1)
check(r.status === 409, 'запись с устаревшей версией отклоняется (409)')
const body = await r.json()
check(body.error === 'version_conflict' && body.version === 2, '409 сообщает актуальную версию')
r = await fetch(BASE)
check((await r.json()).boards.b1.name === 'Вторая', 'после конфликта на сервере осталась чужая версия')

r = await put('Старый клиент', null)
check(r.status === 200, 'клиент без версии пишет как раньше (фронтенд из кеша браузера)')
check((await r.json()).version === 3, 'версия всё равно растёт')

// Гонка: между SELECT и UPDATE в обработчике может вклиниться другой запрос,
// поэтому условие по версии стоит в самом UPDATE.
r = await fetch(BASE)
const v = Number(r.headers.get('x-board-version'))
await r.json()
const [a, b] = await Promise.all([put('Клиент А', v), put('Клиент Б', v)])
const codes = [a.status, b.status].sort()
check(codes[0] === 200 && codes[1] === 409, `гонка: проходит ровно одна запись (${codes.join(' / ')})`)

api.kill()
await pool.end()
console.log(failed ? `\nПровалено: ${failed}` : '\nПройдено: все проверки')
process.exit(failed ? 1 : 0)
