/**
 * Выборки задач (архитектура AI, слой 2).
 *
 * Каждая функция возвращает ссылки на конкретные карточки — именно они потом
 * становятся доказательной частью вывода агента. Пустой результат возвращается
 * пустым списком: «нечего показать» — это тоже факт, его не заменяют текстом.
 */
import type {
  ActivityEvent,
  AnalyticsIndex,
  CardFacts,
  DataQualityIssues,
  Scope,
  TaskRef,
  WipViolation,
} from './types.js'
import { priorityOf, select, toRef } from './analyze.js'

const DAY_HOURS = 24

function at(ix: AnalyticsIndex): Date {
  return new Date(ix.at)
}

function refs(ix: AnalyticsIndex, list: CardFacts[]): TaskRef[] {
  const now = at(ix)
  return list.map((f) => toRef(f, now))
}

/** По сроку, ближайший первым. Без срока — в конец. */
function byDueAsc(a: CardFacts, b: CardFacts): number {
  const x = a.card.dueDate ? new Date(a.card.dueDate).getTime() : Number.POSITIVE_INFINITY
  const y = b.card.dueDate ? new Date(b.card.dueDate).getTime() : Number.POSITIVE_INFINITY
  return x - y
}

/** Просроченные активные задачи, самая давняя просрочка первой. */
export function getOverdueTasks(ix: AnalyticsIndex, scope: Scope = {}): TaskRef[] {
  const list = select(ix, scope)
    .filter((f) => f.overdue)
    .sort(byDueAsc)
  return refs(ix, list)
}

/**
 * Задачи с приближающимся сроком. Окно задаётся в днях (по умолчанию 7).
 * Просроченные сюда не входят — для них отдельная выборка.
 */
export function getUpcomingDeadlines(
  ix: AnalyticsIndex,
  scope: Scope = {},
  withinDays = 7,
): TaskRef[] {
  const limit = withinDays * DAY_HOURS
  const list = select(ix, scope)
    .filter((f) => !f.done && f.hoursToDue !== null && f.hoursToDue >= 0 && f.hoursToDue <= limit)
    .sort(byDueAsc)
  return refs(ix, list)
}

/**
 * Сроки по окнам — то, что получает агент дедлайнов.
 * Окна накопительные: задача из `next24h` входит и в `next48h`, и в `next7days`.
 * `today` — срок сегодня по календарю (может быть меньше 24 часов).
 */
export function getDeadlineBuckets(ix: AnalyticsIndex, scope: Scope = {}) {
  const now = at(ix)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const active = select(ix, scope).filter((f) => !f.done)
  const upcoming = active.filter((f) => f.hoursToDue !== null && f.hoursToDue >= 0)

  const within = (hours: number) =>
    refs(ix, upcoming.filter((f) => (f.hoursToDue as number) <= hours).sort(byDueAsc))

  return {
    at: ix.at,
    overdue: getOverdueTasks(ix, scope),
    today: refs(
      ix,
      upcoming
        .filter((f) => new Date(f.card.dueDate as string).getTime() <= endOfToday.getTime())
        .sort(byDueAsc),
    ),
    next24h: within(24),
    next48h: within(48),
    next7days: within(7 * DAY_HOURS),
  }
}

/** Активные задачи без исполнителя. */
export function getUnassignedTasks(ix: AnalyticsIndex, scope: Scope = {}): TaskRef[] {
  const list = select(ix, scope)
    .filter((f) => !f.done && f.card.assigneeIds.length === 0)
    .sort(byDueAsc)
  return refs(ix, list)
}

/** Активные задачи без срока. */
export function getTasksWithoutDueDate(ix: AnalyticsIndex, scope: Scope = {}): TaskRef[] {
  const list = select(ix, scope).filter((f) => !f.done && !f.card.dueDate)
  return refs(ix, list)
}

/**
 * Критические задачи — активные с приоритетом «критический».
 * Именно приоритет, а не «важные на наш взгляд»: оценку даёт агент.
 */
export function getCriticalTasks(ix: AnalyticsIndex, scope: Scope = {}): TaskRef[] {
  const list = select(ix, scope)
    .filter((f) => !f.done && priorityOf(f.card) === 'critical')
    .sort(byDueAsc)
  return refs(ix, list)
}

/** Списки, где активных карточек не меньше WIP-лимита. */
export function getWipViolations(ix: AnalyticsIndex, scope: Scope = {}): WipViolation[] {
  return Object.values(ix.lists)
    .filter((l) => !scope.boardId || l.boardId === scope.boardId)
    .filter((l) => typeof l.wipLimit === 'number' && l.wipLimit > 0 && l.active >= l.wipLimit)
    .map((l) => ({
      boardId: l.boardId,
      listId: l.id,
      title: l.title,
      active: l.active,
      limit: l.wipLimit as number,
      exceeded: l.active > (l.wipLimit as number),
    }))
    .sort((a, b) => b.active - b.limit - (a.active - a.limit))
}

/** Пробелы в заполнении данных. Это не оценка работы людей, а состояние доски. */
export function getDataQualityIssues(ix: AnalyticsIndex, scope: Scope = {}): DataQualityIssues {
  const active = select(ix, scope).filter((f) => !f.done)
  const invalid = active.filter((f) => {
    if (!f.card.startDate || !f.card.dueDate) return false
    return new Date(f.card.startDate).getTime() > new Date(f.card.dueDate).getTime()
  })
  return {
    at: ix.at,
    unassigned: getUnassignedTasks(ix, scope),
    noDueDate: getTasksWithoutDueDate(ix, scope),
    overdueUnassigned: refs(
      ix,
      active.filter((f) => f.overdue && f.card.assigneeIds.length === 0).sort(byDueAsc),
    ),
    invalidDates: refs(ix, invalid),
  }
}

/**
 * Очередь по срокам: активные задачи с датой, ближайшие первыми.
 * Просроченные идут в начале — это одна шкала времени, а не две разные.
 */
export function getDeadlineQueue(ix: AnalyticsIndex, scope: Scope = {}): TaskRef[] {
  const list = select(ix, scope)
    .filter((f) => !f.done && f.card.dueDate)
    .sort(byDueAsc)
  return refs(ix, list)
}

/**
 * Лента событий: создание задач и сообщения в них, свежие первыми.
 * Это факты из данных, а не выдуманная активность.
 */
export function getRecentActivity(
  ix: AnalyticsIndex,
  scope: Scope = {},
  limit = 5,
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  for (const f of select(ix, scope)) {
    events.push({
      id: `new_${f.card.id}`,
      at: f.card.createdAt,
      kind: 'card_created',
      cardId: f.card.id,
      boardId: f.boardId,
      cardTitle: f.card.title,
    })
    for (const c of f.card.comments) {
      events.push({
        id: c.id,
        at: c.createdAt,
        kind: 'comment',
        cardId: f.card.id,
        boardId: f.boardId,
        cardTitle: f.card.title,
        userId: c.authorId,
      })
    }
  }
  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit)
}
