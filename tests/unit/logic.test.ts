/**
 * Unit-тесты бизнес-логики (запуск: npm run test:unit).
 * Раннер — встроенный node:test, типы снимаются --experimental-strip-types,
 * поэтому дополнительных зависимостей не требуется.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  backfillTaskCodes,
  checklistProgress,
  deadlineCountdown,
  deadlineRemaining,
  dueStatus,
  formatDate,
  nextTaskCode,
  taskCode,
  uid,
} from '../../src/lib/utils.ts'
import { isDoneList, isListDone, listAccentColor } from '../../src/lib/design.ts'
import { loginFromEmail } from '../../src/lib/translit.ts'
import { cardMatchesFilters } from '../../src/lib/filterCards.ts'
import type { BoardState, Card, List } from '../../src/types.ts'

// ——— Коды задач ———

test('код задачи: стабилен для одного id', () => {
  assert.equal(taskCode('card_abc'), taskCode('card_abc'))
})

test('код задачи: постоянный номер уникален для 1000 карточек', () => {
  // Номера присваиваются при создании (nextTaskCode) — как в редьюсере.
  const cards: Record<string, { id: string; code?: number }> = {}
  for (let i = 0; i < 1000; i++) {
    const id = uid('card')
    cards[id] = { id, code: nextTaskCode(cards) }
  }
  const codes = Object.values(cards).map((c) => taskCode(c))
  assert.equal(new Set(codes).size, 1000, 'коды задач должны быть уникальны')
})

test('код задачи: старым карточкам номера проставляются без коллизий', () => {
  const legacy: Record<string, { id: string; createdAt: string; code?: number }> = {}
  for (let i = 0; i < 300; i++) {
    const id = `card_${i}`
    legacy[id] = { id, createdAt: new Date(2026, 0, 1 + (i % 28)).toISOString() }
  }
  const filled = backfillTaskCodes(legacy)
  const codes = Object.values(filled).map((c) => c.code)
  assert.ok(codes.every((c) => typeof c === 'number'))
  assert.equal(new Set(codes).size, 300, 'после миграции коды уникальны')
})

test('код задачи: миграция детерминирована — разные клиенты дают тот же результат', () => {
  const mk = () => {
    const o: Record<string, { id: string; createdAt: string; code?: number }> = {}
    for (let i = 0; i < 50; i++) o[`c${i}`] = { id: `c${i}`, createdAt: new Date(2026, 0, 1 + i).toISOString() }
    return o
  }
  const a = backfillTaskCodes(mk())
  const b = backfillTaskCodes(mk())
  assert.deepEqual(
    Object.keys(a).map((k) => a[k].code),
    Object.keys(b).map((k) => b[k].code),
  )
})

test('код задачи: гарантия — уникальность среди существующих карточек', () => {
  // Номер выдаётся как max+1. После удаления карточки с наибольшим номером он
  // может быть выдан повторно — это допустимо: коллизий между ЖИВЫМИ карточками
  // не возникает, а история кодов в системе не ведётся.
  const cards: Record<string, { id: string; code?: number }> = { a: { id: 'a', code: 101 }, b: { id: 'b', code: 102 } }
  delete cards.b
  const c = { id: 'c', code: nextTaskCode(cards) }
  cards.c = c
  const codes = Object.values(cards).map((x) => x.code)
  assert.equal(new Set(codes).size, codes.length, 'у живых карточек коды не совпадают')
})

test('код задачи: формат IT-<число>', () => {
  assert.match(taskCode('card_x'), /^IT-\d+$/)
})

// ——— Завершённость списка (системный признак, а не текст названия) ———

const mkList = (over: Partial<List> = {}): List => ({ id: 'l1', title: 'To Do', cardIds: [], ...over })

test('список: явный флаг done=true имеет приоритет над названием', () => {
  assert.equal(isListDone(mkList({ title: '111', done: true })), true)
})

test('список: явный флаг done=false отменяет совпадение по названию «Done»', () => {
  assert.equal(isListDone(mkList({ title: 'Done', done: false })), false)
})

test('список: переименование «Done» → «Закрыто» не ломает завершённость при явном флаге', () => {
  const l = mkList({ title: 'Закрыто', done: true })
  assert.equal(isListDone(l), true)
})

test('список без флага: обратная совместимость по названию (Done / Готово)', () => {
  assert.equal(isListDone(mkList({ title: 'Done' })), true)
  assert.equal(isListDone(mkList({ title: 'Готово' })), true)
  assert.equal(isListDone(mkList({ title: 'To Do' })), false)
})

test('список «Архив» без флага не считается активным (не попадает в текущую статистику)', () => {
  assert.equal(isListDone(mkList({ title: 'Архив' })), true)
  assert.equal(isListDone(mkList({ title: 'Archive' })), true)
})

test('пользовательский список «111» не считается выполненным', () => {
  assert.equal(isListDone(mkList({ title: '111' })), false)
})

test('legacy-функция isDoneList остаётся эвристикой по названию', () => {
  assert.equal(isDoneList('Done'), true)
  assert.equal(isDoneList('111'), false)
})

test('цвет списка определяется без падений на любых названиях', () => {
  // Тон стадии теперь берётся из токенов темы, поэтому допустимы и var(--…),
  // и HEX (нейтральный серый вне темы). Пустая строка недопустима: она
  // означала бы полосу без цвета.
  for (const t of ['', '111', 'Done', 'Архив', '🚀 Спринт', 'Ба́за']) {
    assert.match(listAccentColor(t), /^(#[0-9A-Fa-f]{6}|var\(--[a-z-]+\))$/)
  }
})

// ——— Прогресс чек-листа ———

test('прогресс чек-листа: 5 из 8', () => {
  const cls = [{ items: Array.from({ length: 8 }, (_, i) => ({ done: i < 5 })) }]
  const { done, total } = checklistProgress(cls)
  assert.equal(done, 5)
  assert.equal(total, 8)
  assert.equal(Math.round((done / total) * 100), 63) // 62.5 → 63
})

test('прогресс чек-листа: пустой = 0/0, без деления на ноль', () => {
  const { done, total } = checklistProgress([])
  assert.equal(done, 0)
  assert.equal(total, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  assert.equal(pct, 0)
})

test('прогресс чек-листа: несколько чек-листов суммируются, не превышая 100%', () => {
  const cls = [
    { items: [{ done: true }, { done: true }] },
    { items: [{ done: true }, { done: false }] },
  ]
  const { done, total } = checklistProgress(cls)
  assert.equal(done, 3)
  assert.equal(total, 4)
  assert.ok(Math.round((done / total) * 100) <= 100)
})

// ——— Сроки и статусы ———

const NOW = new Date('2026-08-06T12:00:00+05:00') // Душанбе UTC+5

test('срок: без даты статуса нет (задача не просрочена)', () => {
  assert.equal(dueStatus(undefined, false, NOW), null)
})

test('срок: вчерашний = просрочен', () => {
  assert.equal(dueStatus('2026-08-05T12:00:00+05:00', false, NOW), 'overdue')
})

test('срок: завершённая задача не считается просроченной', () => {
  assert.equal(dueStatus('2026-08-05T12:00:00+05:00', true, NOW), 'done')
})

test('срок: в пределах 48 ч = soon, дальше = normal', () => {
  assert.equal(dueStatus('2026-08-07T12:00:00+05:00', false, NOW), 'soon')
  assert.equal(dueStatus('2026-08-20T12:00:00+05:00', false, NOW), 'normal')
})

test('срок сегодня вечером не становится просроченным днём', () => {
  assert.equal(dueStatus('2026-08-06T18:00:00+05:00', false, NOW), 'soon')
})

test('часовой пояс UTC+5: 6 авг 18:00 не уезжает на другую дату при выводе', () => {
  const iso = new Date(2026, 7, 6, 18, 0, 0).toISOString() // локальное 6 авг 18:00
  const out = formatDate(iso)
  assert.equal(out, '6 авг, 18:00')
})

test('formatDate: дата без времени выводится без часов', () => {
  const iso = new Date(2026, 7, 6, 0, 0, 0).toISOString()
  assert.equal(formatDate(iso), '6 авг')
})

test('formatDate: некорректная дата не роняет интерфейс', () => {
  assert.equal(formatDate('не-дата'), '')
})

test('високосный год: 29 февраля обрабатывается', () => {
  const iso = new Date(2028, 1, 29, 10, 30).toISOString()
  assert.match(formatDate(iso), /^29 фев, 10:30$/)
})

test('обратный отсчёт: просрочка со знаком минус, запас — без него', () => {
  const now = NOW.getTime()
  assert.equal(deadlineCountdown(new Date(now - 2 * 86400000).toISOString(), now), '−2д')
  assert.equal(deadlineCountdown(new Date(now + 3600000).toISOString(), now), '01:00')
  assert.equal(deadlineCountdown(undefined, now), '')
})

test('остаток срока: формулировки для панели задачи', () => {
  const now = NOW.getTime()
  assert.match(deadlineRemaining(new Date(now + 2 * 86400000).toISOString(), now), /^осталось 2 дн/)
  assert.match(deadlineRemaining(new Date(now - 86400000 * 3).toISOString(), now), /^просрочено на 3 дн$/)
})

// ——— Фильтры ———

const baseCard = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  title: 'Задача',
  labelIds: [],
  assigneeIds: [],
  priority: 'medium',
  checklists: [],
  comments: [],
  attachments: [],
  createdAt: new Date().toISOString(),
  ...over,
})

const st = (over: Partial<BoardState> = {}): BoardState =>
  ({
    board: { id: 'b', name: 'B', visibility: 'private', listIds: ['l1'], memberIds: ['me'] },
    lists: {},
    cards: {},
    labels: { lb: { id: 'lb', name: 'Бэкенд', color: 'green' } },
    users: { me: { id: 'me', name: 'Я Сам', initials: 'ЯС', color: '#fff' } },
    workspace: { id: 'w', name: 'W', boards: [] },
    currentUserId: 'me',
    ...over,
  }) as BoardState

const NOFILTER = { query: '', onlyMine: false, overdue: false }

test('фильтр: поиск по названию без учёта регистра', () => {
  const c = baseCard({ title: 'Импорт Досок' })
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: 'импорт' }), true)
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: 'экспорт' }), false)
})

test('фильтр: поиск по метке и по исполнителю', () => {
  const c = baseCard({ labelIds: ['lb'], assigneeIds: ['me'] })
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: 'бэкенд' }), true)
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: 'я сам' }), true)
})

test('фильтр: пустой запрос и пробелы не отсекают карточки', () => {
  const c = baseCard()
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: '   ' }), true)
})

test('фильтр «Мои карточки» оставляет только назначенные на текущего пользователя', () => {
  assert.equal(cardMatchesFilters(baseCard({ assigneeIds: ['me'] }), mkList(), st(), { ...NOFILTER, onlyMine: true }), true)
  assert.equal(cardMatchesFilters(baseCard({ assigneeIds: [] }), mkList(), st(), { ...NOFILTER, onlyMine: true }), false)
})

test('фильтр «Просрочено»: задача без срока не считается просроченной', () => {
  assert.equal(cardMatchesFilters(baseCard(), mkList(), st(), { ...NOFILTER, overdue: true }), false)
})

test('фильтр «Просрочено»: завершённая задача в списке «Готово» не просрочена', () => {
  const c = baseCard({ dueDate: '2020-01-01T10:00:00Z' })
  const doneList = mkList({ title: 'Готово', done: true })
  assert.equal(cardMatchesFilters(c, doneList, st(), { ...NOFILTER, overdue: true }), false)
})

test('фильтр «Просрочено»: активная задача с прошедшим сроком проходит', () => {
  const c = baseCard({ dueDate: '2020-01-01T10:00:00Z' })
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, overdue: true }), true)
})

// ——— XSS / спецсимволы: логика не должна падать ———

test('спецсимволы и HTML в названии не ломают фильтр и код задачи', () => {
  const evil = '<img src=x onerror=alert(1)>"\'\\/ 🚀 Матн бо тоҷикӣ'
  const c = baseCard({ title: evil })
  assert.equal(cardMatchesFilters(c, mkList(), st(), { ...NOFILTER, query: 'onerror' }), true)
  assert.match(taskCode(evil), /^IT-\d+$/)
})

// ——— Логин из рабочей почты ———

test('логин создаётся из части адреса до «@»', () => {
  assert.equal(loginFromEmail('ivan@ithona.tj'), 'ivan')
  assert.equal(loginFromEmail('i.ivanov@fazo-tech.tj'), 'i.ivanov')
})

test('логин из почты приводится к нижнему регистру', () => {
  assert.equal(loginFromEmail('Khudoyor@ITHONA.TJ'), 'khudoyor')
  assert.equal(loginFromEmail('  Ivan@ithona.tj  '), 'ivan')
})

test('логин из почты сохраняет точку, дефис и подчёркивание', () => {
  assert.equal(loginFromEmail('i.ivanov-2_a@ithona.tj'), 'i.ivanov-2_a')
})

test('логин из почты убирает недопустимые символы', () => {
  assert.equal(loginFromEmail('ivan+tag@ithona.tj'), 'ivantag')
  assert.equal(loginFromEmail('a b c@ithona.tj'), 'abc')
})

test('логин из почты: кириллица транслитерируется', () => {
  assert.equal(loginFromEmail('иван@ithona.tj'), 'ivan')
  assert.equal(loginFromEmail('худоёр@fazo-tech.tj'), 'khudoyor')
})

test('логин из почты: домен не попадает в логин', () => {
  // Адрес без имени: логин должен остаться пустым, а не стать «ithona.tj».
  assert.equal(loginFromEmail('@ithona.tj'), '')
})

test('логин из почты: пустой ввод не роняет форму', () => {
  assert.equal(loginFromEmail(''), '')
  assert.equal(loginFromEmail('   '), '')
})

test('логин из почты: адрес без «@» используется целиком', () => {
  assert.equal(loginFromEmail('ivan'), 'ivan')
})
