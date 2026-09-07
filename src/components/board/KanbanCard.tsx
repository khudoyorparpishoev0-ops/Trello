import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Paperclip, ListChecks, Clock, Plus, RefreshCw, Timer, BarChart3, Bell } from 'lucide-react'
import type { Card, Label, User } from '@/types'
import { AvatarStack } from '@/components/ui/Avatar'
import { CountBadge, LabelChip } from '@/components/ui/Badge'
import { PriorityFlag } from '@/components/ui/Priority'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { labelColor } from '@/lib/design'
import { useNow } from '@/store/now'
import { useStickerMenu } from './StickerMenu'
import { checklistProgress, cn, deadlineTimer, dueStatus, formatDate, taskCode } from '@/lib/utils'

interface KanbanCardViewProps {
  card: Card
  users: Record<string, User>
  labels: Record<string, Label>
  /** Цвет стадии (передаётся колонкой); если у карточки есть метки — берётся цвет первой. */
  accent: string
  /** Карточка в списке «Готово» — дедлайн не подсвечивается как просроченный. */
  isDone?: boolean
  dragging?: boolean
  overlay?: boolean
  onOpen?: () => void
}

/**
 * Канбан-карточка.
 *
 * Шапка: код · таймер до дедлайна · приоритет. Ниже — метки, название,
 * прогресс и нижний ряд со сроком, счётчиками, стикерами и исполнителями.
 *
 * Два правила, которые нельзя ломать:
 *  — цвет таймера и блока срока задаётся СРОКОМ, а не приоритетом;
 *  — нижний ряд виден всегда: в нём живут кнопки «+», а на тач-устройствах
 *    hover'а нет и спрятанное в него управление становится недоступным.
 */
export function KanbanCardView({ card, users, labels, accent, isDone, dragging, overlay, onOpen }: KanbanCardViewProps) {
  const now = useNow()
  const { openStickerMenu, openAssigneeMenu } = useStickerMenu()
  const { done, total } = checklistProgress(card.checklists)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done === total
  const assignees = card.assigneeIds.map((id) => users[id]).filter(Boolean)
  const cardLabels = card.labelIds.map((id) => labels[id]).filter(Boolean)
  const stripColor = cardLabels[0] ? labelColor(cardLabels[0].color) : accent

  const status = dueStatus(card.dueDate, isDone ?? false, new Date(now))
  const dueInk =
    status === 'overdue' ? 'text-err-ink' : status === 'soon' ? 'text-warn-ink' : 'text-muted'

  const st = card.stickers ?? {}

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group flex cursor-grab select-none overflow-hidden rounded-card bg-surface shadow-card',
        'transition-[transform,box-shadow] ease-smooth',
        'hover:-translate-y-0.5 hover:shadow-card-hover',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-card-hover',
      )}
    >
      {/* Полоса стадии — цвет первой метки, иначе цвет колонки */}
      <span className="w-[3px] shrink-0" style={{ background: stripColor }} aria-hidden />

      <div className="min-w-0 flex-1 p-5">
        {/* Шапка: код · таймер · приоритет */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="mono-data text-muted">{taskCode(card)}</span>
          <span className={cn('mono-data', dueInk)}>{deadlineTimer(card.dueDate, now)}</span>
          <span className="ml-auto shrink-0">
            <PriorityFlag priority={card.priority} withLabel />
          </span>
        </div>

        {cardLabels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {cardLabels.map((l) => (
              <LabelChip key={l.id} name={l.name} color={labelColor(l.color)} />
            ))}
          </div>
        )}

        <h4 className="text-h3 font-medium [text-wrap:pretty]">{card.title}</h4>

        {done > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar value={done} max={total} className="flex-1" />
            <span className="mono-data w-9 text-right text-muted">{pct}%</span>
          </div>
        )}

        {/* Нижний ряд — виден всегда */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className={cn('mono-data inline-flex items-center gap-1', dueInk)}>
            <Clock size={14} strokeWidth={1.6} />
            {card.dueDate ? formatDate(card.dueDate).toUpperCase() : 'СРОКА НЕТ'}
          </span>

          {total > 0 && (
            <span
              className={cn('mono-data inline-flex items-center gap-1', complete ? 'text-ok-ink' : 'text-muted')}
              title={`Чек-лист: ${done} из ${total}`}
            >
              <ListChecks size={14} strokeWidth={1.6} />
              {done}/{total}
            </span>
          )}
          {card.comments.length > 0 && (
            <CountBadge icon={MessageSquare} count={card.comments.length} label="Комментарии" />
          )}
          {card.attachments.length > 0 && (
            <CountBadge icon={Paperclip} count={card.attachments.length} label="Вложения" />
          )}

          {st.repeat && (
            <span className="mono-data inline-flex items-center gap-1 text-brand-ink">
              <RefreshCw size={14} strokeWidth={1.6} /> КАЖДУЮ НЕДЕЛЮ
            </span>
          )}
          {st.stopwatch && (
            <span className="mono-data inline-flex items-center gap-1 text-muted">
              <Timer size={14} strokeWidth={1.6} /> 00:00
            </span>
          )}
          {st.tracking && (
            <span className="mono-data inline-flex items-center gap-1 text-muted">
              <BarChart3 size={14} strokeWidth={1.6} /> {card.spent ?? 0} / {card.planned ?? 8} Ч
            </span>
          )}
          {st.reminder && (
            <span className="mono-data inline-flex items-center gap-1 text-warn-ink">
              <Bell size={14} strokeWidth={1.6} /> ЗА 1 Ч
            </span>
          )}

          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Добавить стикер"
              aria-label="Добавить стикер"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => openStickerMenu(card.id, e)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-chip border border-line-strong text-muted transition-colors hover:border-brand hover:text-brand-ink"
            >
              <Plus size={12} strokeWidth={1.6} />
            </button>
            {assignees.length > 0 && <AvatarStack users={assignees} size="xs" max={3} />}
            <button
              type="button"
              title="Исполнители"
              aria-label="Исполнители"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => openAssigneeMenu(card.id, e)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-chip border border-line-strong text-muted transition-colors hover:border-brand hover:text-brand-ink"
            >
              <Plus size={12} strokeWidth={1.6} />
            </button>
          </span>
        </div>
      </div>
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
