import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Paperclip, CheckSquare, Calendar } from 'lucide-react'
import type { Card, Label, User } from '@/types'
import { AvatarStack } from '@/components/ui/Avatar'
import { CountBadge, LabelChip, Pill } from '@/components/ui/Badge'
import { PriorityFlag } from '@/components/ui/Priority'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { checklistProgress, cn, dueStatus, formatDate } from '@/lib/utils'

interface KanbanCardViewProps {
  card: Card
  users: Record<string, User>
  labels: Record<string, Label>
  /** Цвет индикатора статуса (полоса слева) — по стадии/списку. */
  accent: string
  /** Карточка в списке «Готово» — не подсвечиваем дедлайн как просроченный. */
  isDone?: boolean
  dragging?: boolean
  overlay?: boolean
  onOpen?: () => void
}

/**
 * Канбан-карточка — центральный элемент (Brand Book §7).
 * Состав: индикатор статуса, метки, заголовок, приоритет, дедлайн,
 * прогресс чек-листа, исполнители, счётчики комментариев и вложений.
 */
export function KanbanCardView({
  card,
  users,
  labels,
  accent,
  isDone,
  dragging,
  overlay,
  onOpen,
}: KanbanCardViewProps) {
  const { done, total } = checklistProgress(card.checklists)
  const status = dueStatus(card.dueDate, isDone ?? false)
  const assignees = card.assigneeIds.map((id) => users[id]).filter(Boolean)
  const cardLabels = card.labelIds.map((id) => labels[id]).filter(Boolean)

  const dueTone =
    status === 'overdue' ? 'error' : status === 'soon' ? 'warning' : status === 'done' ? 'success' : 'muted'

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group relative cursor-pointer select-none overflow-hidden rounded-card border border-line bg-surface',
        'p-3 pl-4 transition-all duration-200 ease-smooth',
        'hover:border-line-strong hover:shadow-card-hover hover:-translate-y-0.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-card-hover',
      )}
    >
      {/* Индикатор статуса (полоса) — Brand Book §7 */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        aria-hidden
      />

      {/* Метки */}
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
        </div>
      )}

      {/* Заголовок */}
      <h4 className="line-clamp-2 text-small font-medium leading-5 text-fg">{card.title}</h4>

      {/* Приоритет + дедлайн */}
      {(card.dueDate || card.priority) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PriorityFlag priority={card.priority} withLabel />
          {card.dueDate && (
            <Pill tone={dueTone} icon={Calendar}>
              {formatDate(card.dueDate)}
            </Pill>
          )}
        </div>
      )}

      {/* Прогресс чек-листа */}
      {total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1 text-caption text-muted">
            <CheckSquare size={13} strokeWidth={2} />
            <span className="tabular-nums">
              {done}/{total}
            </span>
          </div>
          <ProgressBar value={done} max={total} />
        </div>
      )}

      {/* Подвал: исполнители + счётчики */}
      {(assignees.length > 0 || card.comments.length > 0 || card.attachments.length > 0) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <AvatarStack users={assignees} size="sm" max={3} />
          <div className="flex items-center gap-3">
            {card.comments.length > 0 && (
              <CountBadge icon={MessageSquare} count={card.comments.length} label="Комментарии" />
            )}
            {card.attachments.length > 0 && (
              <CountBadge icon={Paperclip} count={card.attachments.length} label="Вложения" />
            )}
          </div>
        </div>
      )}
    </article>
  )
}

interface KanbanCardProps extends Omit<KanbanCardViewProps, 'dragging' | 'overlay'> {
  listId: string
}

/** Sortable-обёртка карточки для drag-and-drop. */
export function KanbanCard({ card, listId, ...rest }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <KanbanCardView card={card} dragging={isDragging} {...rest} />
    </div>
  )
}
