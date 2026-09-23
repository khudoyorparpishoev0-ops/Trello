/**
 * Журнал доменных событий (архитектура AI, фаза 2).
 *
 * События строятся из одного набора изменений (`diffBoardState`), а не из
 * второго сравнения состояний. Здесь только перевод «что изменилось» в
 * «что записать»: ни базы, ни времени, ни случайности — иначе ключ события
 * перестал бы быть воспроизводимым, а вместе с ним и защита от дублей.
 */
import type { BoardChangeSet } from './diff.js'
import type { WorkspaceId } from './workspace.js'

/** Типы событий. Список закрыт: неизвестный тип — ошибка, а не новая строка. */
export const EVENT_TYPES = [
  'task.created',
  'task.moved',
  'task.completed',
  'task.reopened',
  'task.assignee_added',
  'task.assignee_removed',
  'task.due_changed',
  'task.priority_changed',
  'comment.created',
  'project.created',
  'project.archived',
  'project.restored',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

/** Запись журнала. Неизменяемая: журнал только дописывается. */
export interface DomainEvent {
  workspaceId: WorkspaceId
  boardId: string | null
  cardId: string | null
  /** О ком событие: исполнитель, автор комментария. Не тот, кто его вызвал. */
  subjectUserId: string | null
  /** Кто вызвал изменение. null — системное действие. Не угадывается. */
  actorUserId: string | null
  eventType: EventType
  payload: Record<string, unknown>
  /** Версия доски, которой принадлежит изменение. */
  boardVersion: number
  /** Детерминированный ключ: по нему повтор не создаёт второй записи. */
  eventKey: string
}

/** Контекст записи: чья версия и чьих рук дело. */
export interface EventContext {
  workspaceId: WorkspaceId
  boardVersion: number
  actorUserId: string | null
}

/** JSON с упорядоченными ключами — иначе отпечаток менялся бы от перестановки. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + stableJson(v)).join(',') + '}'
}

/**
 * Короткий отпечаток полезной нагрузки (FNV-1a).
 * Нужен, чтобы два однотипных события одной карточки в одной версии — скажем,
 * назначение двух разных людей — получили разные ключи.
 */
export function fingerprint(payload: unknown): string {
  const text = stableJson(payload)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Ключ события. Версия доски растёт на каждой записи, поэтому повторная
 * обработка той же версии даёт тот же ключ — и вставка с
 * `ON CONFLICT DO NOTHING` ничего не добавит.
 */
export function eventKey(
  workspaceId: WorkspaceId,
  boardVersion: number,
  eventType: EventType,
  entityId: string,
  payload: unknown,
): string {
  return `${workspaceId}|v${boardVersion}|${eventType}|${entityId}|${fingerprint(payload)}`
}

/** Собрать одно событие, посчитав ключ. */
function event(
  ctx: EventContext,
  eventType: EventType,
  entityId: string,
  fields: {
    boardId?: string | null
    cardId?: string | null
    subjectUserId?: string | null
    payload: Record<string, unknown>
  },
): DomainEvent {
  return {
    workspaceId: ctx.workspaceId,
    boardId: fields.boardId ?? null,
    cardId: fields.cardId ?? null,
    subjectUserId: fields.subjectUserId ?? null,
    actorUserId: ctx.actorUserId,
    eventType,
    payload: fields.payload,
    boardVersion: ctx.boardVersion,
    eventKey: eventKey(ctx.workspaceId, ctx.boardVersion, eventType, entityId, fields.payload),
  }
}

/**
 * Перевести набор изменений в события журнала.
 *
 * Полезная нагрузка минимальна: только то, что нельзя восстановить по ссылкам.
 * Карточка целиком в событие не копируется — для этого есть сама доска.
 */
export function changeSetToEvents(cs: BoardChangeSet, ctx: EventContext): DomainEvent[] {
  const out: DomainEvent[] = []

  for (const c of cs.taskCreated) {
    out.push(event(ctx, 'task.created', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { listId: c.listId, title: c.title },
    }))
  }
  for (const c of cs.taskMoved) {
    out.push(event(ctx, 'task.moved', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { fromListId: c.fromListId, toListId: c.toListId },
    }))
  }
  for (const c of cs.taskCompleted) {
    out.push(event(ctx, 'task.completed', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { listId: c.listId },
    }))
  }
  for (const c of cs.taskReopened) {
    out.push(event(ctx, 'task.reopened', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { listId: c.listId },
    }))
  }
  for (const c of cs.assigneeAdded) {
    out.push(event(ctx, 'task.assignee_added', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      subjectUserId: c.userId,
      payload: { userId: c.userId },
    }))
  }
  for (const c of cs.assigneeRemoved) {
    out.push(event(ctx, 'task.assignee_removed', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      subjectUserId: c.userId,
      payload: { userId: c.userId },
    }))
  }
  for (const c of cs.dueChanged) {
    out.push(event(ctx, 'task.due_changed', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { from: c.from, to: c.to },
    }))
  }
  for (const c of cs.priorityChanged) {
    out.push(event(ctx, 'task.priority_changed', c.cardId, {
      boardId: c.boardId,
      cardId: c.cardId,
      payload: { from: c.from, to: c.to },
    }))
  }
  for (const c of cs.commentCreated) {
    out.push(event(ctx, 'comment.created', c.commentId, {
      boardId: c.boardId,
      cardId: c.cardId,
      subjectUserId: c.authorId,
      payload: { commentId: c.commentId, authorId: c.authorId, createdAt: c.createdAt },
    }))
  }
  for (const c of cs.projectCreated) {
    out.push(event(ctx, 'project.created', c.boardId, {
      boardId: c.boardId,
      payload: { name: c.name },
    }))
  }
  for (const c of cs.projectArchived) {
    out.push(event(ctx, 'project.archived', c.boardId, {
      boardId: c.boardId,
      payload: { name: c.name },
    }))
  }
  for (const c of cs.projectRestored) {
    out.push(event(ctx, 'project.restored', c.boardId, {
      boardId: c.boardId,
      payload: { name: c.name },
    }))
  }

  return out
}
