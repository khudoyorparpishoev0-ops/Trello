/**
 * Интеграционные проверки записи доски на настоящем PostgreSQL.
 * Запуск: npm run test:db (нужна поднятая база).
 *
 * Модульные тесты покрывают решения (`boardGuard.js`), e2e — поведение
 * интерфейса. Здесь проверяется то, что не видно ни там, ни там: SQL, рост
 * номера версии, гонка двух одновременных записей и запрет на удаление
 * проекта не администратором.
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

/** Состояние с двумя проектами — из него один будем «удалять». */
const twoBoards = () => ({
  workspace: { id: 'w1', name: 'IT-HONA', boards: [] },
  users: {},
  currentUserId: 'u1',
  boards: {
    b1: { id: 'b1', name: 'Первый', visibility: 'private', listIds: [], memberIds: [] },
    b2: { id: 'b2', name: 'Второй', visibility: 'private', listIds: [], memberIds: [] },
  },
  boardOrder: ['b1', 'b2'],
  activeBoardId: 'b1',
  lists: {},
  cards: {},
  labels: {},
  departments: [],
})

const putState = (state, version, cookie) =>
  fetch(BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(version === null ? {} : { 'X-Board-Version': String(version) }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(state),
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

console.log('\n▸ Запись доски · PostgreSQL')

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

// ——— Удаление проекта: только администратор (R-02) ———
// Сессии заводим прямо в базе: вход по паролю здесь не проверяется, важно
// лишь то, какую роль увидит обработчик.
const mkUser = async (id, role) => {
  await pool.query(
    `INSERT INTO users (id, login, name, initials, color, role, pass_salt, pass_hash)
     VALUES ($1, $1, $1, 'XX', '#186B36', $2, 'x', 'x')
     ON CONFLICT (id) DO UPDATE SET role = $2`,
    [id, role],
  )
  const token = `tok_${id}`
  await pool.query(
    `INSERT INTO sessions (token, user_id) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET user_id = $2, created_at = now()`,
    [token, id],
  )
  return `sid=${token}`
}
const memberCookie = await mkUser('u_member', 'member')
const adminCookie = await mkUser('u_admin', 'admin')

const currentVersion = async () => {
  const g = await fetch(BASE)
  const v = Number(g.headers.get('x-board-version'))
  await g.json()
  return v
}

// Кладём состояние с двумя проектами.
r = await putState(twoBoards(), await currentVersion(), adminCookie)
check(r.status === 200, 'подготовка: состояние с двумя проектами записано')

// Участник пытается удалить проект.
const withoutSecond = twoBoards()
delete withoutSecond.boards.b2
withoutSecond.boardOrder = ['b1']
r = await putState(withoutSecond, await currentVersion(), memberCookie)
check(r.status === 403, 'участник не может удалить проект (403)')
const forbidden = await r.json()
check(
  forbidden.error === 'forbidden_board_delete' && forbidden.boards?.[0] === 'Второй',
  '403 называет удаляемый проект',
)
r = await fetch(BASE)
check(Object.keys((await r.json()).boards).length === 2, 'проект остался на сервере')

// Участнику при этом не запрещено менять доску: удаление — единственное ограничение.
const renamed = twoBoards()
renamed.boards.b1.name = 'Переименован участником'
r = await putState(renamed, await currentVersion(), memberCookie)
check(r.status === 200, 'участник по-прежнему может править доску')

// Архивация — не удаление.
const archived = twoBoards()
archived.boards.b2.archived = true
r = await putState(archived, await currentVersion(), memberCookie)
check(r.status === 200, 'участник может отправить проект в архив')

// Администратор удаляет.
r = await putState(withoutSecond, await currentVersion(), adminCookie)
check(r.status === 200, 'администратор удаляет проект')
r = await fetch(BASE)
check(Object.keys((await r.json()).boards).length === 1, 'после удаления остался один проект')

api.kill()
await pool.end()
console.log(failed ? `\nПровалено: ${failed}` : '\nПройдено: все проверки')
process.exit(failed ? 1 : 0)
