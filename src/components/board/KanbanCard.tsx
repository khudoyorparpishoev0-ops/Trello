import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Paperclip, CheckSquare, Calendar } from 'lucide-react'
import type { Card, Label, User } from '@/types'
import { AvatarStack } from '@/components/ui/Avatar'
import { CountBadge, LabelChip, Pill } from '@/components/ui/Badge'
import { PriorityFlag } from '@/components/ui/Priority'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { labelColor } from '@/lib/design'
import { checklistProgress, cn, dueStatus, formatDate, taskCode } from '@/lib/utils'

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
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done === total
  // Полоса слева — цвет первой метки (спец §4), иначе цвет стадии.
  const stripColor = cardLabels[0] ? labelColor(cardLabels[0].color) : accent
  const hasFooter =
    !!card.dueDate || total > 0 || card.comments.length > 0 || card.attachments.length > 0 || assignees.length > 0

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group relative cursor-grab select-none overflow-hidden rounded-card border border-line bg-surface shadow-card',
        'py-3 pl-4 pr-3.5 transition-all duration-200 ease-smooth',
        'hover:border-line-strong hover:shadow-card-hover hover:-translate-y-0.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-card-hover',
      )}
    >
      {/* Полоса первой метки (спец §4) */}
      <span
        className="absolute inset-y-[14px] left-0 w-[3px] rounded-r-pill"
        style={{ background: stripColor }}
        aria-hidden
      />

      {/* Код задачи + приоритет */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.02em] text-faint">{taskCode(card.id)}</span>
        <PriorityFlag priority={card.priority} withLabel />
      </div>

      {/* Метки */}
      {cardLabels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cardLabels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
        </div>
      )}

      {/* Заголовок */}
      <h4 className="line-clamp-2 text-[15px] font-semibold leading-5 text-fg">{card.title}</h4>

      {/* Прогресс + процент (только если есть прогресс) */}
      {done > 0 && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <ProgressBar value={done} max={total} className="h-[5px] flex-1" />
          <span className="w-8 text-right text-[11px] font-medium tabular-nums text-muted">{pct}%</span>
        </div>
      )}

      {/* Подвал: срок · чек-лист · комментарии · вложения · исполнители */}
      {hasFooter && (
        <div className="mt-3 flex items-center gap-2.5">
          {card.dueDate && (
            <Pill tone={dueTone} icon={Calendar}>
              {formatDate(card.dueDate)}
            </Pill>
          )}
          {total > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11.5px] font-medium tabular-nums',
                complete ? 'text-success' : 'text-muted',
              )}
            >
              <CheckSquare size={13} strokeWidth={2} />
              {done}/{total}
            </span>
          )}
          {card.comments.length > 0 && (
            <CountBadge icon={MessageSquare} count={card.comments.length} label="Комментарии" />
          )}
          {card.attachments.length > 0 && (
            <CountBadge icon={Paperclip} count={card.attachments.length} label="Вложения" />
          )}
          {assignees.length > 0 && (
            <div className="ml-auto">
              <AvatarStack users={assignees} size="sm" max={3} />
            </div>
          )}
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
