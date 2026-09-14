/**
 * Единственное сравнение состояний доски (архитектура AI, фаза 2).
 *
 * Раньше prev/next сравнивали в двух местах — в уведомлениях о назначении и в
 * уведомлениях о смене срока. Добавить третье сравнение ради журнала событий
 * значило бы получить три источника правды о том, «что изменилось». Здесь оно
 * одно: и уведомления, и журнал читают один результат.
 *
 * Функция чистая: ни базы, ни сети, ни времени. Всё, что нужно потребителям,
 * лежит в самом наборе изменений.
 */
import { isListDone } from './design.js'
import type { AppData, Card, Priority } from './types.js'

/** Общая часть любого изменения карточки. */
export interface TaskChange {
  cardId: string
  boardId: string
  title: string
}

export interface TaskCreated extends TaskChange {
  listId: string
}

export interface TaskMoved extends TaskChange {
  fromListId: string
  toListId: string
}

export interface TaskStageChange extends TaskChange {
  listId: string
}

export interface AssigneeChange extends TaskChange {
  userId: string
}

export interface DueChange extends TaskChange {
  from: string | null
  to: string | null
  /** Кому сообщать. Список исполнителей уже после изменения. */
  assigneeIds: string[]
}

export interface PriorityChange extends TaskChange {
  from: Priority
  to: Priority
}

export interface CommentCreated extends TaskChange {
  commentId: string
  authorId: string
  createdAt: string
}

export interface ProjectChange {
  boardId: string
  name: string
}

/**
 * Что изменилось между двумя состояниями доски.
 * Структура плоская и расширяемая: новый вид изменения — новое поле, старые
 * потребители не ломаются.
 */
export interface BoardChangeSet {
  taskCreated: TaskCreated[]
  taskMoved: TaskMoved[]
  taskCompleted: TaskStageChange[]
  taskReopened: TaskStageChange[]
  assigneeAdded: AssigneeChange[]
  assigneeRemoved: AssigneeChange[]
  dueChanged: DueChange[]
  priorityChanged: PriorityChange[]
  commentCreated: CommentCreated[]
  projectCreated: ProjectChange[]
  projectArchived: ProjectChange[]
  projectRestored: ProjectChange[]
}

/** Пустой набор — им же отвечает сравнение одинаковых состояний. */
export function emptyChangeSet(): BoardChangeSet {
  return {
    taskCreated: [],
    taskMoved: [],
    taskCompleted: [],
    taskReopened: [],
    assigneeAdded: [],
    assigneeRemoved: [],
    dueChanged: [],
    priorityChanged: [],
    commentCreated: [],
    projectCreated: [],
    projectArchived: [],
    projectRestored: [],
  }
}

/** Есть ли в наборе хоть одно изменение. */
export function isEmptyChangeSet(cs: BoardChangeSet): boolean {
  return Object.values(cs).every((list) => list.length === 0)
}

/** Сколько изменений в наборе. */
export function changeCount(cs: BoardChangeSet): number {
  return Object.values(cs).reduce((sum, list) => sum + list.length, 0)
}

/** Где лежит карточка и закрыт ли её список. */
interface Placement {
  listId: string
  boardId: string
  done: boolean
}

/** Разложить состояние: карточка → список, доска, признак «выполнено». */
function placements(data: AppData | null | undefined): Record<string, Placement> {
  const out: Record<string, Placement> = {}
  if (!data?.boards) return out
  for (const boardId of Object.keys(data.boards)) {
    const board = data.boards[boardId]
    if (!board?.listIds) continue
    for (const listId of board.listIds) {
      const list = data.lists?.[listId]
      if (!list) continue
      const done = isListDone(list)
      for (const cardId of list.cardIds ?? []) {
        out[cardId] = { listId, boardId, done }
      }
    }
  }
  return out
}

/** Срок в сравнимом виде: пустая строка и отсутствие — одно и то же. */
function due(card: Card | undefined): string | null {
  return card?.dueDate ? card.dueDate : null
}

/**
 * Сравнить два состояния доски.
 *
 * Правила, важные для смысла событий:
 *
 * 1. У новой карточки не бывает «перемещения» и «смены срока» — она только
 *    создана. Иначе одно действие порождало бы три события.
 * 2. Назначение исполнителя на новой карточке событием считается: это
 *    отдельный факт, и именно на нём держатся уведомления о назначении,
 *    которые работали до появления журнала.
 * 3. Общего «задача изменена» здесь нет намеренно. Правка заголовка или
 *    описания — не то событие, ради которого заводят журнал; оно превратило бы
 *    историю в шум.
 */
export function diffBoardState(
  prev: AppData | null | undefined,
  next: AppData | null | undefined,
): BoardChangeSet {
  const cs = emptyChangeSet()
  if (!next?.cards) return cs

  const prevPlace = placements(prev)
  const nextPlace = placements(next)
  const prevCards = prev?.cards ?? {}

  for (const card of Object.values(next.cards)) {
    const at = nextPlace[card.id]
    // Карточка вне списков (осиротевшая) — про неё сказать нечего.
    if (!at) continue
    const before = prevCards[card.id]
    const was = prevPlace[card.id]
    const title = card.title
    const base = { cardId: card.id, boardId: at.boardId, title }

    if (!before) {
      cs.taskCreated.push({ ...base, listId: at.listId })
      for (const userId of card.assigneeIds ?? []) {
        cs.assigneeAdded.push({ ...base, userId })
      }
      continue
    }

    if (was && was.listId !== at.listId) {
      cs.taskMoved.push({ ...base, fromListId: was.listId, toListId: at.listId })
    }
    if (was && !was.done && at.done) cs.taskCompleted.push({ ...base, listId: at.listId })
    if (was && was.done && !at.done) cs.taskReopened.push({ ...base, listId: at.listId })

    const hadAssignees = new Set(before.assigneeIds ?? [])
    const hasAssignees = new Set(card.assigneeIds ?? [])
    for (const userId of hasAssignees) {
      if (!hadAssignees.has(userId)) cs.assigneeAdded.push({ ...base, userId })
    }
    for (const userId of hadAssignees) {
      if (!hasAssignees.has(userId)) cs.assigneeRemoved.push({ ...base, userId })
    }

    const dueBefore = due(before)
    const dueAfter = due(card)
    if (dueBefore !== dueAfter) {
      cs.dueChanged.push({
        ...base,
        from: dueBefore,
        to: dueAfter,
        assigneeIds: [...hasAssignees],
      })
    }

    if (before.priority !== card.priority) {
      cs.priorityChanged.push({ ...base, from: before.priority, to: card.priority })
    }

    const seen = new Set((before.comments ?? []).map((c) => c.id))
    for (const comment of card.comments ?? []) {
      if (seen.has(comment.id)) continue
      cs.commentCreated.push({
        ...base,
        commentId: comment.id,
        authorId: comment.authorId,
        createdAt: comment.createdAt,
      })
    }
  }

  // ——— Проекты ———
  const prevBoards = prev?.boards ?? {}
  for (const board of Object.values(next.boards ?? {})) {
    const before = prevBoards[board.id]
    const change: ProjectChange = { boardId: board.id, name: board.name }
    if (!before) {
      cs.projectCreated.push(change)
      continue
    }
    const wasArchived = before.archived === true
    const isArchived = board.archived === true
    if (!wasArchived && isArchived) cs.projectArchived.push(change)
    if (wasArchived && !isArchived) cs.projectRestored.push(change)
  }

  return cs
}
