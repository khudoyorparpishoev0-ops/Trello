/**
 * Тесты слоя аналитики (архитектура AI, слой 2).
 *
 * Смысл этих тестов — зафиксировать цифры. Всё, что считает аналитика, должно
 * быть воспроизводимо на фиксированном состоянии и фиксированном «сейчас»:
 * именно на эти числа потом опирается проверка выводов агентов.
 */
process.env.TZ = 'UTC'

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyze,
  getCompanyMetrics,
  getCriticalTasks,
  getDataQualityIssues,
  getDeadlineBuckets,
  getDepartmentMetrics,
  getEmployeeMetrics,
  getOverdueTasks,
  getProjectCompletion,
  getProjectHealthSignals,
  getProjectMetrics,
  getTasksWithoutDueDate,
  getUnassignedTasks,
  getUpcomingDeadlines,
  getWipViolations,
  getWorkloadByDepartment,
  getWorkloadByEmployee,
  WORKLOAD_NORM,
} from '../../src/analytics/index.ts'
import { NOW, fixture } from './fixture.ts'

const ix = analyze(fixture(), NOW)

// ——— Границы расчёта ———

test('аналитика: архивные доски не входят в сводные метрики', () => {
  assert.equal(ix.archivedBoards, 1)
  assert.equal(getCompanyMetrics(ix).boards, 2)
  assert.ok(!ix.activeCards.some((f) => f.card.id === 'c7'), 'архивная карточка не в рабочей выборке')
  // При этом сводку по самой архивной доске запросить можно.
  assert.equal(getProjectMetrics(ix, 'b3')?.counts.total, 1)
})

test('аналитика: момент расчёта фиксируется в индексе', () => {
  assert.equal(ix.at, NOW.toISOString())
})

// ——— Счётчики ———

test('метрики компании: счётчики задач', () => {
  const m = getCompanyMetrics(ix)
  assert.equal(m.counts.total, 6)
  assert.equal(m.counts.done, 1)
  assert.equal(m.counts.active, 5)
  assert.equal(m.counts.overdue, 2)
  assert.equal(m.counts.dueSoon, 2)
  assert.equal(m.counts.unassigned, 2)
  assert.equal(m.counts.noDueDate, 1)
  assert.equal(m.completion, 17)
  assert.equal(m.boards, 2)
  assert.equal(m.archivedBoards, 1)
  assert.equal(m.employees, 3)
})

test('метрики компании: приоритеты считаются только по активным', () => {
  const m = getCompanyMetrics(ix)
  assert.deepEqual(m.byPriority, { critical: 1, high: 2, medium: 1, low: 1 })
})

test('закрытая задача не может быть просроченной', () => {
  // c4 с сроком 5 марта лежит в «Готово» — в просрочку не попадает.
  assert.equal(ix.byId.c4.done, true)
  assert.equal(ix.byId.c4.overdue, false)
  assert.ok(!getOverdueTasks(ix).some((t) => t.cardId === 'c4'))
})

// ——— Проект ———

test('метрики проекта: считаются в границах доски', () => {
  const m = getProjectMetrics(ix, 'b1')
  assert.ok(m)
  assert.equal(m.counts.total, 4)
  assert.equal(m.counts.done, 1)
  assert.equal(m.counts.active, 3)
  assert.equal(m.counts.overdue, 1)
  assert.equal(m.completion, 25)
  assert.equal(m.members, 2)
  assert.equal(m.lists.length, 2)
})

test('метрики проекта: неизвестная доска — null, а не нули', () => {
  assert.equal(getProjectMetrics(ix, 'нет-такой'), null)
  assert.equal(getProjectCompletion(ix, 'b2'), 0)
})

test('сигналы проекта: только доли, без оценок', () => {
  const s = getProjectHealthSignals(ix, 'b1')
  assert.ok(s)
  assert.equal(s.completion, 25)
  assert.equal(s.overdueShare, 33)
  assert.equal(s.unassignedShare, 33)
  assert.equal(s.noDueDateShare, 33)
  assert.equal(s.wipViolations, 1)
  assert.equal(s.active, 3)
})

test('сигналы проекта: дни с последней активности', () => {
  // Последнее событие b2 — сообщение 9 марта, «сейчас» — 10 марта.
  assert.equal(getProjectHealthSignals(ix, 'b2')?.daysSinceActivity, 1)
})

// ——— Сроки ———

test('просроченные: сначала самая давняя', () => {
  const overdue = getOverdueTasks(ix)
  assert.deepEqual(overdue.map((t) => t.cardId), ['c6', 'c1'])
  assert.equal(overdue[0].overdueDays, 18)
  assert.equal(overdue[1].overdueDays, 9)
})

test('окна сроков: накопительные, просроченные отдельно', () => {
  const b = getDeadlineBuckets(ix)
  assert.deepEqual(b.overdue.map((t) => t.cardId), ['c6', 'c1'])
  assert.deepEqual(b.today.map((t) => t.cardId), ['c2'])
  assert.deepEqual(b.next24h.map((t) => t.cardId), ['c2'])
  assert.deepEqual(b.next48h.map((t) => t.cardId), ['c2', 'c5'])
  assert.deepEqual(b.next7days.map((t) => t.cardId), ['c2', 'c5'])
})

test('ближайшие сроки: просроченные в выборку не попадают', () => {
  const up = getUpcomingDeadlines(ix)
  assert.deepEqual(up.map((t) => t.cardId), ['c2', 'c5'])
})

// ——— Загрузка ———

test('загрузка по сотрудникам: норма одна на систему', () => {
  assert.equal(WORKLOAD_NORM, 4)
  const rows = getWorkloadByEmployee(ix)
  const alice = rows.find((r) => r.userId === 'u1')
  assert.ok(alice)
  assert.equal(alice.active, 3, 'задача с архивной доски не считается')
  assert.equal(alice.overdue, 1)
  assert.equal(alice.workload, 75)
  assert.equal(rows.find((r) => r.userId === 'u2')?.active, 1)
  assert.equal(rows.find((r) => r.userId === 'u3')?.active, 0)
})

test('загрузка по сотрудникам: сортировка по числу активных', () => {
  assert.deepEqual(getWorkloadByEmployee(ix).map((r) => r.userId), ['u1', 'u2', 'u3'])
})

test('загрузка по отделам: задача с двумя исполнителями считается один раз', () => {
  const rows = getWorkloadByDepartment(ix)
  const dev = rows.find((r) => r.department === 'Разработка')
  assert.ok(dev)
  // c5 назначена и u1, и u2 — в активных отдела она одна.
  assert.equal(dev.active, 3)
  assert.equal(dev.overdue, 1)
  assert.equal(dev.employees, 2)
  assert.equal(dev.avgWorkload, 50)
})

test('загрузка по отделам: пустой отдел не выдумывает план', () => {
  const design = getWorkloadByDepartment(ix).find((r) => r.department === 'Дизайн')
  assert.ok(design)
  assert.equal(design.employees, 0)
  assert.equal(design.active, 0)
  assert.equal(design.avgWorkload, 0)
})

test('метрики отдела совпадают с загрузкой по отделу', () => {
  const m = getDepartmentMetrics(ix, 'Разработка')
  const row = getWorkloadByDepartment(ix).find((r) => r.department === 'Разработка')
  assert.equal(m.counts.active, row?.active)
  assert.equal(m.avgWorkload, row?.avgWorkload)
})

test('метрики сотрудника: неизвестный id — null', () => {
  assert.equal(getEmployeeMetrics(ix, 'нет-такого'), null)
  const m = getEmployeeMetrics(ix, 'u1')
  assert.equal(m?.counts.active, 3)
  assert.equal(m?.workload, 75)
  assert.equal(m?.department, 'Разработка')
})

test('метрики сотрудника: область сужает выборку до доски', () => {
  assert.equal(getEmployeeMetrics(ix, 'u1', { boardId: 'b1' })?.counts.active, 2)
})

// ——— Качество данных и WIP ———

test('WIP: лимит считается по активным карточкам списка', () => {
  const v = getWipViolations(ix)
  assert.equal(v.length, 1)
  assert.equal(v[0].listId, 'l1')
  assert.equal(v[0].active, 3)
  assert.equal(v[0].limit, 2)
  assert.equal(v[0].exceeded, true)
})

test('качество данных: пробелы перечислены поимённо', () => {
  const q = getDataQualityIssues(ix)
  assert.deepEqual(q.unassigned.map((t) => t.cardId), ['c6', 'c3'])
  assert.deepEqual(q.noDueDate.map((t) => t.cardId), ['c3'])
  assert.deepEqual(q.overdueUnassigned.map((t) => t.cardId), ['c6'])
  assert.deepEqual(q.invalidDates.map((t) => t.cardId), ['c6'])
})

test('выборки без результата возвращают пустой список', () => {
  const empty = analyze(
    { ...fixture(), boards: {}, boardOrder: [], lists: {}, cards: {} },
    NOW,
  )
  assert.deepEqual(getOverdueTasks(empty), [])
  assert.deepEqual(getUnassignedTasks(empty), [])
  assert.deepEqual(getTasksWithoutDueDate(empty), [])
  assert.deepEqual(getCriticalTasks(empty), [])
  assert.equal(getCompanyMetrics(empty).completion, 0)
})

test('критические задачи: только приоритет, без домыслов', () => {
  assert.deepEqual(getCriticalTasks(ix).map((t) => t.cardId), ['c1'])
})
