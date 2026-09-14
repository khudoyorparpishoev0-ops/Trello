/**
 * Тесты единственного сравнения состояний доски (фаза 2).
 *
 * Главное, что здесь проверяется, — не наличие событий, а их отсутствие там,
 * где их быть не должно: одно действие пользователя обязано давать ровно те
 * факты, которые произошли. Иначе журнал за неделю превратится в шум, и
 * историческая аналитика будет считать по нему ерунду.
 */
process.env.TZ = 'UTC'

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changeCount,
  diffBoardState,
  isEmptyChangeSet,
} from '../../shared/domain/diff.ts'
import { changeSetToEvents, eventKey } from '../../shared/domain/events.ts'
import type { AppData } from '../../shared/domain/types.ts'
import { fixture } from './fixture.ts'

const CTX = { workspaceId: 'default', boardVersion: 7, actorUserId: 'u1' }

/** Копия состояния: тесты меняют её, не задевая исходный образец. */
function clone(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData
}

/** Типы событий, которые даёт изменение — в порядке появления. */
function types(prev: AppData, next: AppData): string[] {
  return changeSetToEvents(diffBoardState(prev, next), CTX).map((e) => e.eventType)
}

// ——— Ничего не изменилось ———

test('одинаковые состояния не дают ни одного изменения', () => {
  const data = fixture()
  const cs = diffBoardState(data, clone(data))
  assert.ok(isEmptyChangeSet(cs))
  assert.equal(changeCount(cs), 0)
  assert.deepEqual(changeSetToEvents(cs, CTX), [])
})

test('повторная запись того же состояния не создаёт событий', () => {
  const data = fixture()
  // Именно этот случай и случается при повторной отправке одной и той же доски.
  assert.equal(changeCount(diffBoardState(clone(data), clone(data))), 0)
})

// ——— Карточки ———

test('созданная карточка — одно событие, без «перемещения» и «смены срока»', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.new1 = {
    id: 'new1',
    title: 'Новая задача',
    labelIds: [],
    assigneeIds: [],
    priority: 'medium',
    dueDate: '2026-03-20T12:00:00.000Z',
    checklists: [],
    comments: [],
    attachments: [],
    createdAt: '2026-03-10T00:00:00.000Z',
  }
  next.lists.l1.cardIds.push('new1')
  assert.deepEqual(types(prev, next), ['task.created'])
})

test('созданная карточка с исполнителем даёт и назначение', () => {
  // Уведомление о назначении работало и до журнала — поведение сохраняется.
  const prev = fixture()
  const next = clone(prev)
  next.cards.new2 = {
    id: 'new2',
    title: 'С исполнителем',
    labelIds: [],
    assigneeIds: ['u1', 'u2'],
    priority: 'medium',
    checklists: [],
    comments: [],
    attachments: [],
    createdAt: '2026-03-10T00:00:00.000Z',
  }
  next.lists.l1.cardIds.push('new2')
  assert.deepEqual(types(prev, next), ['task.created', 'task.assignee_added', 'task.assignee_added'])
})

test('перемещение между списками — одно событие', () => {
  const prev = fixture()
  const next = clone(prev)
  next.lists.l1.cardIds = next.lists.l1.cardIds.filter((id) => id !== 'c3')
  next.lists.l3.cardIds.push('c3')
  const cs = diffBoardState(prev, next)
  assert.equal(cs.taskMoved.length, 1)
  assert.equal(cs.taskMoved[0].fromListId, 'l1')
  assert.equal(cs.taskMoved[0].toListId, 'l3')
  assert.deepEqual(types(prev, next), ['task.moved'])
})

test('перенос в «Готово» — и перемещение, и закрытие', () => {
  const prev = fixture()
  const next = clone(prev)
  next.lists.l1.cardIds = next.lists.l1.cardIds.filter((id) => id !== 'c1')
  next.lists.l2.cardIds.push('c1')
  assert.deepEqual(types(prev, next), ['task.moved', 'task.completed'])
})

test('возврат из «Готово» — перемещение и переоткрытие', () => {
  const prev = fixture()
  const next = clone(prev)
  next.lists.l2.cardIds = next.lists.l2.cardIds.filter((id) => id !== 'c4')
  next.lists.l1.cardIds.push('c4')
  assert.deepEqual(types(prev, next), ['task.moved', 'task.reopened'])
})

test('список помечен выполненным — закрываются все его задачи', () => {
  // Одно действие, но фактов столько, сколько задач: так оно и есть.
  const prev = fixture()
  const next = clone(prev)
  next.lists.l1.done = true
  const cs = diffBoardState(prev, next)
  assert.equal(cs.taskCompleted.length, 3)
  assert.equal(cs.taskMoved.length, 0, 'карточки никуда не двигались')
})

test('назначение и снятие исполнителя', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.assigneeIds = ['u2']
  next.cards.c1.assigneeIds = []
  const cs = diffBoardState(prev, next)
  assert.deepEqual(cs.assigneeAdded.map((c) => [c.cardId, c.userId]), [['c3', 'u2']])
  assert.deepEqual(cs.assigneeRemoved.map((c) => [c.cardId, c.userId]), [['c1', 'u1']])
})

test('смена срока: было → стало, со списком исполнителей', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c1.dueDate = '2026-03-15T12:00:00.000Z'
  const cs = diffBoardState(prev, next)
  assert.equal(cs.dueChanged.length, 1)
  assert.equal(cs.dueChanged[0].from, '2026-03-01T12:00:00.000Z')
  assert.equal(cs.dueChanged[0].to, '2026-03-15T12:00:00.000Z')
  assert.deepEqual(cs.dueChanged[0].assigneeIds, ['u1'])
})

test('снятый срок — тоже смена срока', () => {
  const prev = fixture()
  const next = clone(prev)
  delete next.cards.c1.dueDate
  assert.equal(diffBoardState(prev, next).dueChanged[0].to, null)
})

test('пустая строка в сроке равна отсутствию срока', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.dueDate = ''
  assert.equal(changeCount(diffBoardState(prev, next)), 0)
})

test('смена приоритета', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.priority = 'critical'
  const cs = diffBoardState(prev, next)
  assert.deepEqual(cs.priorityChanged.map((c) => [c.from, c.to]), [['medium', 'critical']])
})

test('новый комментарий определяется по id, старые не повторяются', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c1.comments.push({
    id: 'cm_new',
    authorId: 'u2',
    text: 'сообщение',
    createdAt: '2026-03-10T11:00:00.000Z',
  })
  const cs = diffBoardState(prev, next)
  assert.equal(cs.commentCreated.length, 1)
  assert.equal(cs.commentCreated[0].commentId, 'cm_new')
  // У c5 в образце уже есть комментарий — он не должен всплыть заново.
  assert.ok(!cs.commentCreated.some((c) => c.cardId === 'c5'))
})

test('правка заголовка событий не порождает', () => {
  // Общего «задача изменена» в журнале нет намеренно.
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.title = 'Другое название'
  next.cards.c3.description = 'и описание'
  assert.equal(changeCount(diffBoardState(prev, next)), 0)
})

// ——— Проекты ———

test('создание, архивирование и восстановление проекта', () => {
  const prev = fixture()
  let next = clone(prev)
  next.boards.b4 = { id: 'b4', name: 'Новый', visibility: 'workspace', listIds: [], memberIds: [] }
  next.boardOrder.push('b4')
  assert.deepEqual(types(prev, next), ['project.created'])

  next = clone(prev)
  next.boards.b1.archived = true
  assert.deepEqual(types(prev, next), ['project.archived'])

  next = clone(prev)
  next.boards.b3.archived = false
  assert.deepEqual(types(prev, next), ['project.restored'])
})

// ——— Первая запись ———

test('первое сохранение: пустое «до» даёт создание всего', () => {
  const next = fixture()
  const cs = diffBoardState(null, next)
  assert.equal(cs.projectCreated.length, 3)
  assert.equal(cs.taskCreated.length, 7)
  assert.equal(cs.taskMoved.length, 0)
  assert.equal(cs.dueChanged.length, 0, 'у новой карточки срок не «менялся»')
})

// ——— Ключи событий ———

test('ключ события воспроизводим и не зависит от порядка полей', () => {
  const a = eventKey('default', 7, 'task.due_changed', 'c1', { from: 'x', to: 'y' })
  const b = eventKey('default', 7, 'task.due_changed', 'c1', { to: 'y', from: 'x' })
  assert.equal(a, b, 'перестановка полей не должна менять ключ')
})

test('ключ различает разные версии, типы, сущности и нагрузку', () => {
  const base = ['default', 7, 'task.assignee_added', 'c1'] as const
  const k1 = eventKey(...base, { userId: 'u1' })
  const k2 = eventKey(...base, { userId: 'u2' })
  const k3 = eventKey('default', 8, 'task.assignee_added', 'c1', { userId: 'u1' })
  const k4 = eventKey('other', 7, 'task.assignee_added', 'c1', { userId: 'u1' })
  assert.equal(new Set([k1, k2, k3, k4]).size, 4)
})

test('внутри одной версии все ключи различны', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.assigneeIds = ['u1', 'u2', 'u3']
  next.cards.c3.priority = 'high'
  next.cards.c3.dueDate = '2026-03-20T12:00:00.000Z'
  const events = changeSetToEvents(diffBoardState(prev, next), CTX)
  assert.ok(events.length >= 5)
  assert.equal(new Set(events.map((e) => e.eventKey)).size, events.length)
})

test('событие несёт версию доски и автора, но не угадывает его', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.assigneeIds = ['u2']
  const [e] = changeSetToEvents(diffBoardState(prev, next), CTX)
  assert.equal(e.boardVersion, 7)
  assert.equal(e.actorUserId, 'u1', 'автор — тот, кто сохранял доску')
  assert.equal(e.subjectUserId, 'u2', 'а речь в событии про назначенного')

  const system = changeSetToEvents(diffBoardState(prev, next), { ...CTX, actorUserId: null })
  assert.equal(system[0].actorUserId, null, 'системное изменение остаётся без автора')
})

test('нагрузка события минимальна — карточка целиком в неё не копируется', () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c1.dueDate = '2026-03-15T12:00:00.000Z'
  const [e] = changeSetToEvents(diffBoardState(prev, next), CTX)
  assert.deepEqual(Object.keys(e.payload).sort(), ['from', 'to'])
})
