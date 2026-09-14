/**
 * Сводные метрики (архитектура AI, слой 2).
 * Всё считается из индекса; ни одна функция не обращается к CORE напрямую.
 */
import type {
  AnalyticsIndex,
  CardFacts,
  CompanyMetrics,
  DepartmentMetrics,
  EmployeeMetrics,
  PriorityCounts,
  ProjectMetrics,
  Scope,
  TaskCounts,
} from './types.js'
import {
  activeOf,
  departmentOf,
  emptyPriorityCounts,
  pct,
  priorityOf,
  select,
  workloadPct,
} from './analyze.js'

/** Базовые счётчики по произвольному набору карточек. */
export function countTasks(list: CardFacts[]): TaskCounts {
  const counts: TaskCounts = {
    total: list.length,
    done: 0,
    active: 0,
    overdue: 0,
    dueSoon: 0,
    unassigned: 0,
    noDueDate: 0,
  }
  for (const f of list) {
    if (f.done) {
      counts.done += 1
      continue
    }
    counts.active += 1
    if (f.overdue) counts.overdue += 1
    if (f.dueSoon) counts.dueSoon += 1
    if (f.card.assigneeIds.length === 0) counts.unassigned += 1
    if (!f.card.dueDate) counts.noDueDate += 1
  }
  return counts
}

/** Разбивка активных задач по приоритетам. Закрытые не в счёт. */
export function countByPriority(list: CardFacts[]): PriorityCounts {
  const out = emptyPriorityCounts()
  for (const f of list) {
    if (f.done) continue
    out[priorityOf(f.card)] += 1
  }
  return out
}

/** Метрики задач в области: то же, что счётчики, отдельной функцией по ТЗ. */
export function getTaskMetrics(ix: AnalyticsIndex, scope: Scope = {}): TaskCounts {
  return countTasks(select(ix, scope))
}

/** Метрики компании — всё пространство без архива. */
export function getCompanyMetrics(ix: AnalyticsIndex): CompanyMetrics {
  const counts = countTasks(ix.activeCards)
  return {
    at: ix.at,
    counts,
    byPriority: countByPriority(ix.activeCards),
    completion: pct(counts.done, counts.total),
    boards: ix.boards.filter((b) => !b.archived).length,
    archivedBoards: ix.archivedBoards,
    employees: Object.keys(ix.users).length,
    departments: ix.departments.length,
  }
}

/** Метрики одного проекта (доски). Нет такой доски — null, без выдумывания нулей. */
export function getProjectMetrics(ix: AnalyticsIndex, boardId: string): ProjectMetrics | null {
  const board = ix.boards.find((b) => b.id === boardId)
  if (!board) return null
  const list = ix.byBoard[boardId] ?? []
  const counts = countTasks(list)

  // Состав списков — агенту нужно понимать, где стоят задачи.
  const lists = Object.values(ix.lists)
    .filter((l) => l.boardId === boardId)
    .map((l) => ({ id: l.id, title: l.title, active: l.active, done: l.done, wipLimit: l.wipLimit }))

  return {
    at: ix.at,
    boardId,
    name: board.name,
    counts,
    byPriority: countByPriority(list),
    completion: pct(counts.done, counts.total),
    members: board.memberIds.length,
    lists,
  }
}

/** Метрики сотрудника. Неизвестный id — null. */
export function getEmployeeMetrics(
  ix: AnalyticsIndex,
  userId: string,
  scope: Scope = {},
): EmployeeMetrics | null {
  const user = ix.users[userId]
  if (!user) return null
  const mine = (ix.byAssignee[userId] ?? []).filter((f) =>
    scope.boardId ? f.boardId === scope.boardId : !f.archived,
  )
  const counts = countTasks(mine)
  return {
    at: ix.at,
    userId,
    name: user.name,
    department: departmentOf(user),
    counts,
    workload: workloadPct(counts.active),
    completion: pct(counts.done, counts.total),
    byPriority: countByPriority(mine),
  }
}

/**
 * Метрики отдела. Отдел берётся из профилей сотрудников; задача засчитывается
 * отделу один раз, даже если в ней несколько исполнителей из него.
 */
export function getDepartmentMetrics(
  ix: AnalyticsIndex,
  department: string,
  scope: Scope = {},
): DepartmentMetrics {
  const members = Object.values(ix.users).filter((u) => departmentOf(u) === department)
  const memberIds = new Set(members.map((u) => u.id))

  const seen = new Set<string>()
  const cards: CardFacts[] = []
  for (const f of select(ix, scope)) {
    if (seen.has(f.card.id)) continue
    if (!f.card.assigneeIds.some((id) => memberIds.has(id))) continue
    seen.add(f.card.id)
    cards.push(f)
  }

  const loads = members.map((u) => {
    const mine = (ix.byAssignee[u.id] ?? []).filter(
      (f) => !f.done && (scope.boardId ? f.boardId === scope.boardId : !f.archived),
    )
    return workloadPct(mine.length)
  })

  return {
    at: ix.at,
    department,
    employees: members.length,
    counts: countTasks(cards),
    avgWorkload: loads.length ? Math.round(loads.reduce((s, v) => s + v, 0) / loads.length) : 0,
  }
}

/** Доля закрытых задач проекта, %. Нет доски или задач — 0. */
export function getProjectCompletion(ix: AnalyticsIndex, boardId: string): number {
  return getProjectMetrics(ix, boardId)?.completion ?? 0
}

/** Активные карточки области — вспомогательное, чтобы не повторять фильтр. */
export function activeIn(ix: AnalyticsIndex, scope: Scope = {}): CardFacts[] {
  return activeOf(select(ix, scope))
}
