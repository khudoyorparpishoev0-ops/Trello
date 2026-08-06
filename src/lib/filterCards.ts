import type { BoardState, Card, List } from '@/types'
import type { Filters } from '@/components/board/Board'
import { isListDone } from '@/lib/design'
import { dueStatus } from '@/lib/utils'

/** Общая проверка карточки против быстрых фильтров (Доска / Таблица / Таймлайн). */
export function cardMatchesFilters(card: Card, list: List, st: BoardState, f: Filters): boolean {
  const q = f.query.trim().toLowerCase()
  if (q) {
    const hay = [
      card.title,
      card.description ?? '',
      ...card.labelIds.map((id) => st.labels[id]?.name ?? ''),
      ...card.assigneeIds.map((id) => st.users[id]?.name ?? ''),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.onlyMine && !card.assigneeIds.includes(st.currentUserId)) return false
  if (f.overdue && dueStatus(card.dueDate, isListDone(list)) !== 'overdue') return false
  return true
}
