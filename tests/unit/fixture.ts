/**
 * Состояние-образец для тестов аналитики и AI-слоя.
 *
 * Один набор данных на оба набора тестов: если проверка выводов агента
 * опирается на другие числа, чем сама аналитика, проверка ничего не значит.
 */
import type { AppData, Card, List, Priority, User } from '../../src/types.ts'

/** «Сейчас» для всех расчётов. Все сроки в образце заданы относительно него. */
export const NOW = new Date('2026-03-10T12:00:00.000Z')

export function user(id: string, name: string, department?: string): User {
  return { id, name, initials: name.slice(0, 2).toUpperCase(), color: '#186b36', department }
}

interface CardSpec {
  id: string
  assignees?: string[]
  due?: string
  start?: string
  priority?: Priority
  comments?: string[]
}

export function card(spec: CardSpec): Card {
  return {
    id: spec.id,
    title: `Задача ${spec.id}`,
    labelIds: [],
    assigneeIds: spec.assignees ?? [],
    priority: spec.priority ?? 'medium',
    dueDate: spec.due,
    startDate: spec.start,
    checklists: [],
    comments: (spec.comments ?? []).map((at, i) => ({
      id: `${spec.id}_cm${i}`,
      authorId: 'u1',
      text: 'сообщение',
      createdAt: at,
    })),
    attachments: [],
    createdAt: '2026-02-01T00:00:00.000Z',
  }
}

export function list(id: string, title: string, cardIds: string[], wipLimit?: number): List {
  return { id, title, cardIds, wipLimit }
}

/**
 * Состояние для всех проверок.
 *
 *   b1 «Платформа»   l1 «В работе» (WIP 2): c1 просрочена, c2 срок сегодня, c3 ничья
 *                    l2 «Готово»:           c4 закрыта
 *   b2 «Сайт»        l3 «Бэклог»:           c5 срок через 48 ч, c6 просрочена и ничья
 *   b3 «Архив»       архивная — не должна попадать никуда
 */
export function fixture(): AppData {
  const cards: Record<string, Card> = {
    c1: card({ id: 'c1', assignees: ['u1'], due: '2026-03-01T12:00:00.000Z', priority: 'critical' }),
    c2: card({ id: 'c2', assignees: ['u1'], due: '2026-03-10T12:30:00.000Z', priority: 'high' }),
    c3: card({ id: 'c3' }),
    c4: card({ id: 'c4', assignees: ['u2'], due: '2026-03-05T12:00:00.000Z' }),
    c5: card({
      id: 'c5',
      assignees: ['u1', 'u2'],
      due: '2026-03-12T12:00:00.000Z',
      priority: 'low',
      comments: ['2026-03-09T12:00:00.000Z'],
    }),
    c6: card({
      id: 'c6',
      due: '2026-02-20T12:00:00.000Z',
      start: '2026-03-01T12:00:00.000Z',
      priority: 'high',
    }),
    c7: card({ id: 'c7', assignees: ['u1'], due: '2026-01-01T12:00:00.000Z', priority: 'critical' }),
  }

  return {
    workspace: { id: 'w1', name: 'IT-HONA', boards: [] },
    users: {
      u1: user('u1', 'Алиса', 'Разработка'),
      u2: user('u2', 'Борис', 'Разработка'),
      u3: user('u3', 'Вера'),
    },
    currentUserId: 'u1',
    boards: {
      b1: { id: 'b1', name: 'Платформа', visibility: 'workspace', listIds: ['l1', 'l2'], memberIds: ['u1', 'u2'] },
      b2: { id: 'b2', name: 'Сайт', visibility: 'workspace', listIds: ['l3'], memberIds: ['u2'] },
      b3: { id: 'b3', name: 'Архив', visibility: 'workspace', listIds: ['l4'], memberIds: ['u1'], archived: true },
    },
    boardOrder: ['b1', 'b2', 'b3'],
    activeBoardId: 'b1',
    lists: {
      l1: list('l1', 'В работе', ['c1', 'c2', 'c3'], 2),
      l2: list('l2', 'Готово', ['c4']),
      l3: list('l3', 'Бэклог', ['c5', 'c6']),
      l4: list('l4', 'В работе', ['c7']),
    },
    cards,
    labels: {},
    departments: ['Разработка', 'Дизайн'],
  }
}
