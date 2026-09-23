/**
 * Типы слоя аналитики (архитектура AI, слой 2).
 *
 * Здесь описаны только ЦИФРЫ. Ни одна структура в этом файле не содержит
 * оценок, степеней важности и рекомендаций: их даёт слой агентов. Правило
 * простое — если поле нельзя получить арифметикой из CORE Data, ему здесь не
 * место.
 */
import type { Card, Priority, User } from '../domain/types.js'

/** Что известно про одну карточку после разбора состояния. */
export interface CardFacts {
  card: Card
  boardId: string
  listId: string
  /** Лежит в списке с признаком «задачи выполнены». */
  done: boolean
  /** Просрочена. Считается только для незакрытых карточек. */
  overdue: boolean
  /** Срок наступает в ближайшие 48 часов (и ещё не прошёл). */
  dueSoon: boolean
  /** Часов до срока: отрицательное — просрочка. null — срока нет. */
  hoursToDue: number | null
  /** Лежит на архивной доске. Такие карточки не входят в сводные метрики. */
  archived: boolean
}

/** Список (колонка) со своими признаками. */
export interface ListFacts {
  id: string
  title: string
  boardId: string
  /** Признак «задачи выполнены» — по флагу списка либо по названию. */
  done: boolean
  wipLimit?: number
  /** Активных карточек в списке. */
  active: number
}

/**
 * Разобранное состояние: карточки с фактами плюс индексы.
 * Строится один раз, все расчёты читают его — поэтому «выполнено» и
 * «просрочено» во всей системе считаются ровно один раз.
 */
export interface AnalyticsIndex {
  /** Момент расчёта, ISO. Все относительные величины считаны на него. */
  at: string
  /** Все карточки, включая архивные доски. */
  cards: CardFacts[]
  /** Рабочие карточки: всё, кроме архивных досок. База сводных метрик. */
  activeCards: CardFacts[]
  byId: Record<string, CardFacts>
  byBoard: Record<string, CardFacts[]>
  /** Карточки, назначенные на сотрудника. Одна карточка может быть у нескольких. */
  byAssignee: Record<string, CardFacts[]>
  boards: { id: string; name: string; archived: boolean; memberIds: string[] }[]
  /** Списки не-архивных досок: нужны названия и WIP-лимиты. */
  lists: Record<string, ListFacts>
  users: Record<string, User>
  departments: string[]
  /** Сколько досок в архиве. В сводные метрики их задачи не входят. */
  archivedBoards: number
}

/**
 * Ограничение выборки. Пусто — всё пространство без архива.
 * Названная доска берётся как есть, даже если она в архиве: сводка архивного
 * проекта — законный запрос, просто в метрики компании он не входит.
 */
export interface Scope {
  boardId?: string
}

/** Счётчики задач — основа почти всех метрик. */
export interface TaskCounts {
  total: number
  done: number
  active: number
  /** Из активных. */
  overdue: number
  /** Из активных: срок в пределах 48 ч. */
  dueSoon: number
  /** Из активных: без исполнителя. */
  unassigned: number
  /** Из активных: без срока. */
  noDueDate: number
}

/** Разбивка активных задач по приоритетам. */
export type PriorityCounts = Record<Priority, number>

export interface CompanyMetrics {
  at: string
  counts: TaskCounts
  byPriority: PriorityCounts
  /** Доля закрытых от всех, %. 0 при отсутствии задач. */
  completion: number
  boards: number
  archivedBoards: number
  employees: number
  departments: number
}

export interface ProjectMetrics {
  at: string
  boardId: string
  name: string
  counts: TaskCounts
  byPriority: PriorityCounts
  completion: number
  members: number
  lists: { id: string; title: string; active: number; done: boolean; wipLimit?: number }[]
}

export interface DepartmentMetrics {
  at: string
  department: string
  employees: number
  counts: TaskCounts
  /** Средняя загрузка сотрудников отдела, %. */
  avgWorkload: number
}

export interface EmployeeMetrics {
  at: string
  userId: string
  name: string
  department: string | null
  counts: TaskCounts
  /** Активных задач / норму, %. Потолок 100. */
  workload: number
  /** Доля закрытых от всех задач сотрудника, %. */
  completion: number
  byPriority: PriorityCounts
}

/** Строка загрузки — сотрудник и его активные задачи. */
export interface WorkloadRow {
  userId: string
  name: string
  department: string | null
  active: number
  overdue: number
  /** Активных / норму, %. Потолок 100. */
  workload: number
}

export interface DepartmentWorkloadRow {
  department: string
  employees: number
  /** Сотрудники отдела — по ним считается средняя загрузка. */
  userIds: string[]
  /** Задачи отдела: одна задача засчитывается один раз, сколько бы исполнителей из отдела в ней ни было. */
  total: number
  done: number
  active: number
  overdue: number
  /** Доля закрытых от всех задач отдела, %. */
  completion: number
  /** Среднее по сотрудникам отдела, %. 0 — в отделе никого нет. */
  avgWorkload: number
}

/** Событие ленты: создание задачи или сообщение в ней. Факт, не оценка. */
export interface ActivityEvent {
  id: string
  at: string
  kind: 'card_created' | 'comment'
  cardId: string
  boardId: string
  cardTitle: string
  /** Автор сообщения. У создания карточки автор не хранится. */
  userId?: string
}

/** Состояние срока задачи. Считается один раз, в слое аналитики. */
export type DueState = 'overdue' | 'soon' | 'normal' | 'none'

/** Ссылка на задачу — то, чем агент подтверждает вывод. */
export interface TaskRef {
  cardId: string
  code?: number
  title: string
  boardId: string
  dueDate?: string
  /** Срок: просрочен / в пределах 48 ч / в срок / не задан. */
  dueState: DueState
  priority: Priority
  assigneeIds: string[]
  /** Дней просрочки (для просроченных). */
  overdueDays?: number
  /** Часов до срока (для ближайших). */
  hoursToDue?: number
}

/** Нарушение WIP-лимита списка. */
export interface WipViolation {
  boardId: string
  listId: string
  title: string
  active: number
  limit: number
  /** true — лимит превышен, false — достигнут ровно. */
  exceeded: boolean
}

/** Проблемы данных: не оценка работы, а пробелы в заполнении. */
export interface DataQualityIssues {
  at: string
  unassigned: TaskRef[]
  noDueDate: TaskRef[]
  /** Пересечение: просрочено и при этом не на кого. */
  overdueUnassigned: TaskRef[]
  /** Дата начала позже срока — заполнено с ошибкой. */
  invalidDates: TaskRef[]
}

/** Сигналы проекта — только доли и количества, без вердиктов. */
export interface ProjectHealthSignals {
  at: string
  boardId: string
  name: string
  completion: number
  /** Доля просроченных среди активных, %. */
  overdueShare: number
  /** Доля активных без исполнителя, %. */
  unassignedShare: number
  /** Доля активных без срока, %. */
  noDueDateShare: number
  wipViolations: number
  active: number
  /** Дней с последнего события (создание карточки или сообщение). null — событий нет. */
  daysSinceActivity: number | null
}
