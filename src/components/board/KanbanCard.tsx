import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, Paperclip, CheckSquare, Calendar, Clock } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Card, Label, User } from '@/types'
import { AvatarStack } from '@/components/ui/Avatar'
import { CountBadge, LabelChip } from '@/components/ui/Badge'
import { PriorityFlag } from '@/components/ui/Priority'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { labelColor } from '@/lib/design'
import { useNow } from '@/store/now'
import { checklistProgress, cn, deadlineCountdown, dueStatus, formatDate, taskCode } from '@/lib/utils'

interface KanbanCardViewProps {
  card: Card
  users: Record<string, User>
  labels: Record<string, Label>
  /** Цвет полосы/стадии (передаётся колонкой); если у карточки есть метки — берётся цвет первой. */
  accent: string
  /** Карточка в списке «Готово» — дедлайн не подсвечивается как просроченный. */
  isDone?: boolean
  dragging?: boolean
  overlay?: boolean
  onOpen?: () => void
}

/**
 * Канбан-карточка (ТЗ «Карточка задачи»).
 * Шапка: код · таймер до дедлайна · приоритет. Ниже: метки, название,
 * прогресс, нижний ряд (дедлайн-блок, чек-лист, комментарии, вложения, аватары).
 */
export function KanbanCardView({ card, users, labels, accent, isDone, dragging, overlay, onOpen }: KanbanCardViewProps) {
  const now = useNow()
  const { done, total } = checklistProgress(card.checklists)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done === total
  const assignees = card.assigneeIds.map((id) => users[id]).filter(Boolean)
  const cardLabels = card.labelIds.map((id) => labels[id]).filter(Boolean)
  const stripColor = cardLabels[0] ? labelColor(cardLabels[0].color) : accent || 'rgba(140,140,150,.5)'

  // Цвет таймера и блока дедлайна определяется СРОКОМ, а не приоритетом (ТЗ §4.4).
  const status = dueStatus(card.dueDate, isDone ?? false, new Date(now))
  const dueColor = status === 'overdue' ? '#EF4444' : status === 'soon' ? '#F59E0B' : null
  const timerStyle: CSSProperties = dueColor
    ? { color: dueColor, background: `color-mix(in srgb, ${dueColor} 14%, transparent)` }
    : { color: 'var(--faint)', background: 'var(--hover)' }
  const blockStyle: CSSProperties = dueColor
    ? {
        color: dueColor,
        background: `color-mix(in srgb, ${dueColor} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${dueColor} 30%, transparent)`,
      }
    : { color: 'var(--muted)', background: 'var(--hover)', borderColor: 'var(--line)' }

  const hasBottom =
    !!card.dueDate || total > 0 || card.comments.length > 0 || card.attachments.length > 0 || assignees.length > 0

  return (
    <article
      onClick={onOpen}
      className={cn(
        'group relative cursor-grab select-none overflow-hidden rounded-card border border-line bg-surface shadow-card',
        'flex flex-col gap-[9px] py-3 pl-4 pr-3.5 transition-[transform,box-shadow,border-color] duration-200 ease-smooth',
        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-card-hover',
      )}
    >
      {/* Полоса статуса — цвет первой метки (ТЗ §1) */}
      <span
        className="absolute inset-y-[14px] left-0 w-[3px] rounded-r-[3px]"
        style={{ background: stripColor }}
        aria-hidden
      />

      {/* Шапка: код · таймер до дедлайна · приоритет — в одну строку */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.02em] text-faint">{taskCode(card.id)}</span>
        {card.dueDate && (
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] px-[7px] py-0.5 font-mono text-[11px] font-semibold"
            style={timerStyle}
          >
            <Clock size={11} strokeWidth={2} />
            {deadlineCountdown(card.dueDate, now)}
          </span>
        )}
        <span className="ml-auto shrink-0">
          <PriorityFlag priority={card.priority} withLabel />
        </span>
      </div>

      {/* Метки */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cardLabels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} />
          ))}
        </div>
      )}

      {/* Название — без обрезки, переносится */}
      <h4 className="text-[15px] font-semibold leading-5 text-fg [text-wrap:pretty]">{card.title}</h4>

      {/* Прогресс — только если > 0 */}
      {done > 0 && (
        <div className="flex items-center gap-2.5">
          <ProgressBar value={done} max={total} className="h-[5px] flex-1" />
          <span className="w-8 text-right font-mono text-[11px] font-semibold tabular-nums text-faint">{pct}%</span>
        </div>
      )}

      {/* Нижний ряд */}
      {hasBottom && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted">
            {card.dueDate && (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-[8px] border px-[7px] py-[3px] text-[11px] font-semibold"
                style={blockStyle}
              >
                <Calendar size={13} strokeWidth={2} />
                {formatDate(card.dueDate)}
              </span>
            )}
            {total > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[12px] font-medium tabular-nums',
                  complete ? 'text-success' : 'text-muted',
                )}
              >
                <CheckSquare size={14} strokeWidth={2} />
                {done}/{total}
              </span>
            )}
            {card.comments.length > 0 && (
              <CountBadge icon={MessageSquare} count={card.comments.length} label="Комментарии" />
            )}
            {card.attachments.length > 0 && (
              <CountBadge icon={Paperclip} count={card.attachments.length} label="Вложения" />
            )}
          </div>
          {assignees.length > 0 && (
            <div className="ml-auto flex pl-1.5">
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
