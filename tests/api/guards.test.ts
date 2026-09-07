/**
 * Тесты серверных защит: проверка полезной нагрузки доски, снимки истории,
 * ограничение попыток входа. Запуск: npm run test:api
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBoardPayload,
  cardCount,
  shouldSnapshot,
  parseVersion,
  versionConflict,
  removedBoards,
  canDeleteBoards,
} from '../../api/boardGuard.js'
import {
  limiterKey,
  registerFailure,
  registerSuccess,
  retryAfter,
  _reset,
  LIMITS,
} from '../../api/rateLimit.js'

// ——— Проверка состояния доски (P0: защита от затирания) ———

const validBoard = () => ({
  workspace: { id: 'w', name: 'IT-HONA', boards: [] },
  users: {},
  currentUserId: 'u1',
  boards: { b1: { id: 'b1', name: 'Проект', visibility: 'private', listIds: ['l1'], memberIds: [] } },
  boardOrder: ['b1'],
  activeBoardId: 'b1',
  lists: { l1: { id: 'l1', title: 'To Do', cardIds: [] } },
  cards: {},
  labels: {},
  departments: [],
})

test('валидное состояние доски принимается', () => {
  assert.equal(validateBoardPayload(validBoard()).ok, true)
})

test('пустой объект {} отклоняется — иначе затирал доску всей компании', () => {
  assert.equal(validateBoardPayload({}).ok, false)
})

for (const bad of [null, undefined, 'строка', 42, true, [], [1, 2, 3]]) {
  test(`не-объект (${JSON.stringify(bad) ?? 'undefined'}) отклоняется`, () => {
    assert.equal(validateBoardPayload(bad).ok, false)
  })
}

test('состояние без досок отклоняется', () => {
  const d = validBoard()
  d.boards = {}
  assert.equal(validateBoardPayload(d).ok, false)
})

for (const key of ['boards', 'lists', 'cards']) {
  test(`поле «${key}» неверного типа отклоняется`, () => {
    const d = validBoard()
    // @ts-expect-error — проверяем защиту от неверного типа
    d[key] = []
    const r = validateBoardPayload(d)
    assert.equal(r.ok, false)
    assert.match(r.detail, new RegExp(key))
  })
}

test('boardOrder обязан быть массивом', () => {
  const d = validBoard()
  // @ts-expect-error — намеренно неверный тип
  d.boardOrder = {}
  assert.equal(validateBoardPayload(d).ok, false)
})

test('activeBoardId обязателен', () => {
  const d = validBoard()
  d.activeBoardId = ''
  assert.equal(validateBoardPayload(d).ok, false)
})

test('лишние (неизвестные) поля не мешают сохранению', () => {
  const d = { ...validBoard(), somethingNew: { a: 1 } }
  assert.equal(validateBoardPayload(d).ok, true)
})

// ——— Снимки истории ———

const withCards = (n: number) => {
  const d = validBoard()
  for (let i = 0; i < n; i++) d.cards[`c${i}`] = { id: `c${i}` }
  return d
}

test('cardCount считает карточки и не падает на мусоре', () => {
  assert.equal(cardCount(withCards(7)), 7)
  assert.equal(cardCount(null), 0)
  assert.equal(cardCount('строка'), 0)
})

test('снимок обязателен при заметной потере карточек (защита от стирания)', () => {
  const now = Date.now()
  // 100 → 3 карточки, снимок только что делался — всё равно снимаем
  assert.equal(shouldSnapshot(withCards(100), withCards(3), new Date(now).toISOString(), now), true)
})

test('обычное редактирование не плодит снимки чаще раза в 5 минут', () => {
  const now = Date.now()
  const recent = new Date(now - 60_000).toISOString()
  assert.equal(shouldSnapshot(withCards(50), withCards(51), recent, now), false)
})

test('по истечении интервала снимок делается', () => {
  const now = Date.now()
  const old = new Date(now - 10 * 60_000).toISOString()
  assert.equal(shouldSnapshot(withCards(50), withCards(51), old, now), true)
})

test('без предыдущего состояния снимок не нужен', () => {
  assert.equal(shouldSnapshot(null, withCards(5), null), false)
})

// ——— Ограничение попыток входа (защита от перебора) ———

test('после серии неудач вход временно закрывается', () => {
  _reset()
  const key = limiterKey('10.0.0.1', 'admin')
  assert.equal(retryAfter(key), 0)
  for (let i = 0; i < LIMITS.MAX_FAILS - 1; i++) registerFailure(key)
  assert.equal(retryAfter(key), 0, 'до порога вход открыт')
  registerFailure(key)
  assert.ok(retryAfter(key) > 0, 'после порога — блокировка')
})

test('успешный вход сбрасывает счётчик', () => {
  _reset()
  const key = limiterKey('10.0.0.2', 'admin')
  for (let i = 0; i < 5; i++) registerFailure(key)
  registerSuccess(key)
  for (let i = 0; i < LIMITS.MAX_FAILS - 1; i++) registerFailure(key)
  assert.equal(retryAfter(key), 0)
})

test('блокировка не задевает другого пользователя и другой IP', () => {
  _reset()
  const victim = limiterKey('10.0.0.3', 'admin')
  for (let i = 0; i < LIMITS.MAX_FAILS; i++) registerFailure(victim)
  assert.ok(retryAfter(victim) > 0)
  assert.equal(retryAfter(limiterKey('10.0.0.4', 'admin')), 0, 'другой IP не заблокирован')
  assert.equal(retryAfter(limiterKey('10.0.0.3', 'egor')), 0, 'другой логин не заблокирован')
})

test('ключ ограничения не зависит от регистра логина', () => {
  assert.equal(limiterKey('1.1.1.1', 'Admin'), limiterKey('1.1.1.1', 'admin'))
})

test('блокировка снимается по истечении срока', () => {
  _reset()
  const key = limiterKey('10.0.0.5', 'admin')
  const t0 = Date.now()
  for (let i = 0; i < LIMITS.MAX_FAILS; i++) registerFailure(key, t0)
  assert.ok(retryAfter(key, t0) > 0)
  assert.equal(retryAfter(key, t0 + LIMITS.BLOCK_MS + 1000), 0)
})

// ——— Версия доски: защита от затирания чужих правок ———

test('версия разбирается из заголовка только как целое число', () => {
  assert.equal(parseVersion('7'), 7)
  assert.equal(parseVersion(' 12 '), 12)
  assert.equal(parseVersion('0'), 0)
})

test('отсутствие или мусор в заголовке версии дают null, а не ноль', () => {
  // Ноль — валидная версия, поэтому «нет заголовка» обязано отличаться от неё.
  assert.equal(parseVersion(undefined), null)
  assert.equal(parseVersion(null), null)
  assert.equal(parseVersion(''), null)
  assert.equal(parseVersion('   '), null)
  assert.equal(parseVersion('abc'), null)
  assert.equal(parseVersion('3.5'), null)
  assert.equal(parseVersion('-1'), null)
})

test('расхождение версий — конфликт', () => {
  assert.equal(versionConflict(1, 2), true)
  assert.equal(versionConflict(5, 4), true)
})

test('совпадение версий — записываем', () => {
  assert.equal(versionConflict(2, 2), false)
  assert.equal(versionConflict(0, 0), false)
  // pg отдаёт bigint строкой — сравнение обязано это переживать.
  assert.equal(versionConflict(3, '3'), false)
  assert.equal(versionConflict(3, '4'), true)
})

test('клиент без версии пишет как раньше (фронтенд из кеша браузера)', () => {
  assert.equal(versionConflict(null, 7), false)
  assert.equal(versionConflict(undefined, 7), false)
})

test('на сервере версии ещё нет — сверять не с чем', () => {
  assert.equal(versionConflict(1, null), false)
  assert.equal(versionConflict(1, undefined), false)
})

// ——— Удаление проектов: только администратор (R-02) ———

const withBoards = (ids: string[]) => ({
  boards: Object.fromEntries(ids.map((id) => [id, { id, name: `Проект ${id}`, archived: false }])),
  lists: {},
  cards: {},
})

test('исчезнувшая доска распознаётся как удалённая', () => {
  assert.deepEqual(removedBoards(withBoards(['a', 'b']), withBoards(['a'])), ['Проект b'])
})

test('без удалений список пуст', () => {
  assert.deepEqual(removedBoards(withBoards(['a', 'b']), withBoards(['a', 'b'])), [])
  assert.deepEqual(removedBoards(withBoards(['a']), withBoards(['a', 'b'])), [])
})

test('архивация — не удаление: доска остаётся в состоянии', () => {
  const prev = withBoards(['a'])
  const next = { ...withBoards(['a']) }
  next.boards.a = { ...next.boards.a, archived: true }
  assert.deepEqual(removedBoards(prev, next), [])
})

test('прежнего состояния нет — удалять было нечего', () => {
  assert.deepEqual(removedBoards(null, withBoards(['a'])), [])
  assert.deepEqual(removedBoards(undefined, withBoards(['a'])), [])
})

test('удалять проекты может администратор', () => {
  assert.equal(canDeleteBoards({ role: 'admin' }), true)
})

test('участник и наблюдатель — не могут', () => {
  assert.equal(canDeleteBoards({ role: 'member' }), false)
  assert.equal(canDeleteBoards({ role: 'observer' }), false)
  assert.equal(canDeleteBoards({}), false)
})

test('режим открытого доступа: актора нет, ролей нет — поведение прежнее', () => {
  assert.equal(canDeleteBoards(null), true)
  assert.equal(canDeleteBoards(undefined), true)
})
