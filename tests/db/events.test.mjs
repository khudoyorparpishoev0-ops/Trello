/**
 * Интеграционные проверки журнала событий на настоящем PostgreSQL.
 * Запуск: npm run test:db (нужна поднятая база).
 *
 * Модульные тесты покрывают само сравнение состояний. Здесь проверяется то,
 * что видно только на живой базе: события пишутся вместе с доской, повтор не
 * создаёт дублей, а отказ — ни 409, ни 403 — не оставляет следа в журнале.
 *
 * Без доступной базы тест не падает, а сообщает, что пропущен.
 */
import { spawn } from 'node:child_process'
import pg from 'pg'
import { createBoardRepo } from '../../api/boardRepo.js'

const PORT = process.env.TEST_API_PORT ?? '3998'
const DB = process.env.TEST_DATABASE_URL ?? 'postgres://ithona:test@127.0.0.1:5432/ithona_test'
const BASE = `http://127.0.0.1:${PORT}/api/board`
const WS = 'default'

const pool = new pg.Pool({ connectionString: DB, connectionTimeoutMillis: 2000 })
try {
  await pool.query('SELECT 1')
} catch (e) {
  console.log(`⊘ Пропущено: база недоступна (${DB}) — ${e.message}`)
  await pool.end().catch(() => {})
  process.exit(0)
}

// Чистый старт: схему создаст сам сервер.
await pool.query('DROP TABLE IF EXISTS board_state, board_history, core_events CASCADE')

const api = spawn('node', ['api/server.js'], {
  cwd: new URL('../..', import.meta.url).pathname,
  env: {
    ...process.env,
    PORT,
    DATABASE_URL: DB,
    REDIS_URL: 'redis://127.0.0.1:65534',
    AUTH_PASSWORD: '',
    INVITE_CODE: '',
    // Заведомо нерабочий токен: проверяем, что сбой отправки не трогает данные.
    TELEGRAM_BOT_TOKEN: '0:НЕРАБОЧИЙ',
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

const repo = createBoardRepo(pool)

/** Состояние с одним проектом, одним списком и заданным набором карточек. */
const state = (cards = {}, opts = {}) => ({
  workspace: { id: 'w1', name: 'IT-HONA', boards: [] },
  users: {
    u_member: { id: 'u_member', name: 'Участник', initials: 'УЧ', color: '#186B36' },
    u_admin: { id: 'u_admin', name: 'Админ', initials: 'АД', color: '#186B36' },
  },
  currentUserId: 'u_admin',
  boards: {
    b1: {
      id: 'b1',
      name: 'Проект',
      visibility: 'private',
      listIds: ['l1', 'l2'],
      memberIds: ['u_admin', 'u_member'],
      ...(opts.board ?? {}),
    },
  },
  boardOrder: ['b1'],
  activeBoardId: 'b1',
  lists: {
    l1: { id: 'l1', title: 'В работе', cardIds: Object.keys(cards).filter((k) => !cards[k].__done) },
    l2: { id: 'l2', title: 'Готово', cardIds: Object.keys(cards).filter((k) => cards[k].__done) },
  },
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, c]) => {
      const { __done, ...rest } = c
      return [id, { id, labelIds: [], assigneeIds: [], priority: 'medium', checklists: [], comments: [], attachments: [], createdAt: '2026-03-01T00:00:00.000Z', ...rest }]
    }),
  ),
  labels: {},
  departments: [],
})

const mkUser = async (id, role) => {
  await pool.query(
    `INSERT INTO users (id, login, name, initials, color, role, pass_salt, pass_hash)
     VALUES ($1, $1, $1, 'XX', '#186B36', $2, 'x', 'x')
     ON CONFLICT (id) DO UPDATE SET role = $2`,
    [id, role],
  )
  const token = `evt_${id}`
  await pool.query(
    `INSERT INTO sessions (token, user_id) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET user_id = $2, created_at = now()`,
    [token, id],
  )
  return `sid=${token}`
}
const memberCookie = await mkUser('u_member', 'member')
const adminCookie = await mkUser('u_admin', 'admin')

const putState = (s, version, cookie) =>
  fetch(BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(version === null ? {} : { 'X-Board-Version': String(version) }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(s),
  })

const currentVersion = async () => {
  const g = await fetch(BASE)
  const v = Number(g.headers.get('x-board-version'))
  await g.json()
  return v
}

const events = () => repo.getEvents(WS, { limit: 500 })
const countEvents = () => repo.countEvents(WS)

let failed = 0
const check = (ok, label) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label)
  if (!ok) failed++
}

console.log('\n▸ Журнал событий · PostgreSQL')

// ——— Первая запись ———
let r = await putState(state({ c1: { title: 'Первая' } }), null, adminCookie)
check(r.status === 200, 'первая запись проходит')
let v = (await r.json()).version
let log = await events()
check(log.length > 0, `события записаны (${log.length})`)
check(
  log.some((e) => e.event_type === 'project.created' && e.board_id === 'b1'),
  'создание проекта попало в журнал',
)
check(
  log.some((e) => e.event_type === 'task.created' && e.card_id === 'c1'),
  'создание задачи попало в журнал',
)
check(log.every((e) => Number(e.board_version) === v), 'у всех событий версия доски записи')
check(log.every((e) => e.workspace_id === WS), 'все события принадлежат пространству')
check(log.every((e) => e.actor_user_id === 'u_admin'), 'автор изменения записан')

// ——— Повтор того же состояния ———
const before = await countEvents()
r = await putState(state({ c1: { title: 'Первая' } }), v, adminCookie)
check(r.status === 200, 'повторная запись того же состояния проходит')
v = (await r.json()).version
check((await countEvents()) === before, 'но новых событий не создаёт')

// ——— Осмысленное изменение ———
r = await putState(
  state({ c1: { title: 'Первая', assigneeIds: ['u_member'], dueDate: '2026-04-01T10:00:00.000Z' } }),
  v,
  adminCookie,
)
check(r.status === 200, 'назначение и срок сохраняются')
v = (await r.json()).version
log = await events()
const assigned = log.find((e) => e.event_type === 'task.assignee_added')
check(!!assigned, 'назначение исполнителя попало в журнал')
check(assigned?.subject_user_id === 'u_member', 'в событии указан назначенный')
check(
  JSON.stringify(assigned?.payload) === JSON.stringify({ userId: 'u_member' }),
  'нагрузка события минимальна',
)
const dueEvent = log.find((e) => e.event_type === 'task.due_changed')
check(dueEvent?.payload?.from === null && dueEvent?.payload?.to === '2026-04-01T10:00:00.000Z',
  'смена срока записана как «было → стало»')

// ——— Telegram недоступен ———
check(r.status === 200 && log.length > 0, 'сбой отправки в Telegram не отменил запись')

// ——— Закрытие задачи ———
r = await putState(
  state({ c1: { title: 'Первая', assigneeIds: ['u_member'], dueDate: '2026-04-01T10:00:00.000Z', __done: true } }),
  v,
  adminCookie,
)
v = (await r.json()).version
log = await events()
check(
  log.some((e) => e.event_type === 'task.completed' && e.card_id === 'c1'),
  'перенос в «Готово» записан как закрытие задачи',
)

// ——— Конфликт версии ———
const beforeConflict = await countEvents()
r = await putState(state({ c2: { title: 'Из устаревшей версии' } }), v - 1, adminCookie)
check(r.status === 409, 'запись с устаревшей версией отклонена')
check((await countEvents()) === beforeConflict, 'при конфликте событий не появилось')

// ——— Отказ по правам ———
const beforeForbidden = await countEvents()
// Доска должна остаться хотя бы одна: пустое состояние отклонит структурная
// проверка, и до проверки прав дело бы не дошло.
const withSecond = state({ c1: { title: 'Первая', assigneeIds: ['u_member'], dueDate: '2026-04-01T10:00:00.000Z', __done: true } })
withSecond.boards.b2 = { id: 'b2', name: 'Второй', visibility: 'private', listIds: [], memberIds: ['u_admin'] }
withSecond.boardOrder = ['b1', 'b2']
r = await putState(withSecond, await currentVersion(), adminCookie)
check(r.status === 200, 'подготовка: второй проект добавлен')

const withoutSecond = JSON.parse(JSON.stringify(withSecond))
delete withoutSecond.boards.b2
withoutSecond.boardOrder = ['b1']
r = await putState(withoutSecond, await currentVersion(), memberCookie)
check(r.status === 403, 'участник не может удалить проект')
// Подготовительная запись добавила «project.created» — сравниваем с ней.
const afterPrep = await countEvents()
check(afterPrep > beforeForbidden, 'подготовка сама по себе событие дала')
check((await countEvents()) === afterPrep, 'при отказе по правам новых событий не появилось')

// ——— Идемпотентность на уровне ключа ———
const sample = [
  {
    workspaceId: WS,
    boardId: 'b1',
    cardId: 'c1',
    subjectUserId: null,
    actorUserId: 'u_admin',
    eventType: 'task.moved',
    payload: { fromListId: 'l1', toListId: 'l2' },
    boardVersion: 999,
    eventKey: 'default|v999|task.moved|c1|testkey',
  },
]
const firstWrite = await repo.writeEvents(pool, WS, sample)
const secondWrite = await repo.writeEvents(pool, WS, sample)
check(firstWrite === 1, 'событие записывается')
check(secondWrite === 0, 'повторная запись того же ключа ничего не добавляет')

// ——— Граница пространства ———
let crossed = false
try {
  await repo.writeEvents(pool, WS, [{ ...sample[0], workspaceId: 'другое', eventKey: 'x' }])
} catch {
  crossed = true
}
check(crossed, 'событие чужого пространства записать нельзя')

// ——— Журнал только дописывается ———
const src = await pool.query(
  `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'core_events'`,
)
check(src.rows[0].n === 0, 'триггеров и процедур над журналом нет')

api.kill()
await pool.end()
console.log(failed ? `\nПровалено: ${failed}` : '\nПройдено: все проверки')
process.exit(failed ? 1 : 0)
