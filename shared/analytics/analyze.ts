/**
 * Разбор состояния CORE в индекс фактов (архитектура AI, слой 2).
 *
 * «Выполнено» и «просрочено» считаются здесь ровно один раз, через те же
 * `isListDone` и `dueStatus`, которыми пользуется интерфейс. Дублировать эти
 * правила где-либо ещё — в экране, в агенте, в отчёте — нельзя: один
 * показатель, один источник расчёта.
 */
import { isListDone } from '../domain/design.js'
import { dueStatus } from '../domain/utils.js'
import type { AppData, Card, Priority, User } from '../domain/types.js'
import type { AnalyticsIndex, CardFacts, ListFacts, PriorityCounts, Scope, TaskRef } from './types.js'

const HOUR = 60 * 60 * 1000

/** Норма активных задач на человека. Единственное объявление в системе. */
export const WORKLOAD_NORM = 4

/** Пустая разбивка по приоритетам — чтобы ключи были всегда все четыре. */
export function emptyPriorityCounts(): PriorityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 }
}

/**
 * Построить индекс.
 *
 * Разбираются все доски, но сводные метрики читают только `activeCards`:
 * архивный проект скрыт из работы, и его задачи исказили бы и загрузку, и
 * просрочки. Сводку по конкретной архивной доске при этом всё ещё можно
 * запросить — через `scope.boardId`.
 */
export function analyze(data: AppData, now: Date = new Date()): AnalyticsIndex {
  const cards: CardFacts[] = []
  const activeCards: CardFacts[] = []
  const byId: Record<string, CardFacts> = {}
  const byBoard: Record<string, CardFacts[]> = {}
  const byAssignee: Record<string, CardFacts[]> = {}
  const boards: AnalyticsIndex['boards'] = []
  const lists: Record<string, ListFacts> = {}
  let archivedBoards = 0

  for (const boardId of data.boardOrder) {
    const board = data.boards[boardId]
    if (!board) continue
    const archived = board.archived === true
    if (archived) archivedBoards += 1
    boards.push({ id: board.id, name: board.name, archived, memberIds: board.memberIds })
    byBoard[board.id] = []

    for (const listId of board.listIds) {
      const list = data.lists[listId]
      if (!list) continue
      const done = isListDone(list)
      const listFacts: ListFacts = {
        id: list.id,
        title: list.title,
        boardId: board.id,
        done,
        wipLimit: list.wipLimit,
        active: 0,
      }
      lists[list.id] = listFacts

      for (const cardId of list.cardIds) {
        const card = data.cards[cardId]
        if (!card) continue
        const status = dueStatus(card.dueDate, done, now)
        const facts: CardFacts = {
          card,
          boardId: board.id,
          listId: list.id,
          done,
          overdue: status === 'overdue',
          dueSoon: status === 'soon',
          hoursToDue: card.dueDate
            ? (new Date(card.dueDate).getTime() - now.getTime()) / HOUR
            : null,
          archived,
        }
        if (!done && !archived) listFacts.active += 1
        if (!archived) activeCards.push(facts)
        cards.push(facts)
        byId[card.id] = facts
        byBoard[board.id].push(facts)
        for (const uid of card.assigneeIds) {
          const bucket = (byAssignee[uid] ??= [])
          bucket.push(facts)
        }
      }
    }
  }

  return {
    at: now.toISOString(),
    cards,
    activeCards,
    byId,
    byBoard,
    byAssignee,
    boards,
    lists,
    users: data.users,
    departments: data.departments,
    archivedBoards,
  }
}

/** Карточки в пределах области: вся не-архивная работа либо одна названная доска. */
export function select(ix: AnalyticsIndex, scope: Scope = {}): CardFacts[] {
  if (!scope.boardId) return ix.activeCards
  return ix.byBoard[scope.boardId] ?? []
}

/** Активные — это всё, что не лежит в списке «выполнено». */
export function activeOf(list: CardFacts[]): CardFacts[] {
  return list.filter((f) => !f.done)
}

/** Процент с защитой от деления на ноль: нет базы — ноль, а не NaN. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/** Загрузка сотрудника: активные задачи от нормы, потолок 100 %. */
export function workloadPct(active: number): number {
  return Math.min(100, Math.round((active / WORKLOAD_NORM) * 100))
}

/** Ссылка на задачу для доказательной части вывода агента. */
export function toRef(f: CardFacts, now: Date): TaskRef {
  const ref: TaskRef = {
    cardId: f.card.id,
    code: f.card.code,
    title: f.card.title,
    boardId: f.boardId,
    dueDate: f.card.dueDate,
    dueState: !f.card.dueDate ? 'none' : f.overdue ? 'overdue' : f.dueSoon ? 'soon' : 'normal',
    priority: priorityOf(f.card),
    assigneeIds: f.card.assigneeIds,
  }
  if (f.card.dueDate) {
    const diffHours = (new Date(f.card.dueDate).getTime() - now.getTime()) / HOUR
    if (f.overdue) ref.overdueDays = Math.floor(-diffHours / 24)
    else ref.hoursToDue = Math.round(diffHours)
  }
  return ref
}

/** Отдел сотрудника. Не заполнен — null, а не пустая строка и не «Прочее». */
export function departmentOf(user: User | undefined): string | null {
  const d = user?.department?.trim()
  return d ? d : null
}

/** Приоритет карточки — с запасом на данные, где его нет. */
export function priorityOf(card: Card): Priority {
  return card.priority ?? 'medium'
}
