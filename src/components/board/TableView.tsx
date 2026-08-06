import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Filters } from './Board'
import { AvatarStack } from '@/components/ui/Avatar'
import { PriorityFlag } from '@/components/ui/Priority'
import { useBoard } from '@/store/boardStore'
import { isListDone, listAccentColor } from '@/lib/design'
import { cardMatchesFilters } from '@/lib/filterCards'
import { checklistProgress, cn, dueStatus, formatDate, taskCode } from '@/lib/utils'

interface TableViewProps {
  filters: Filters
  onOpenCard: (cardId: string) => void
}

const COLS = 'grid-cols-[84px_minmax(240px,1fr)_150px_130px_150px_90px_120px]'

/** Вид «Таблица»: все карточки активной доски одной таблицей. */
export function TableView({ filters, onOpenCard }: TableViewProps) {
  const { state } = useBoard()

  const rows = useMemo(() => {
    const out: { cardId: string; listTitle: string; accent: string; done: boolean }[] = []
    for (const lid of state.board.listIds) {
      const l = state.lists[lid]
      if (!l) continue
      const accent = l.color || listAccentColor(l.title)
      const done = isListDone(l)
      for (const cid of l.cardIds) {
        const c = state.cards[cid]
        if (!c || !cardMatchesFilters(c, l, state, filters)) continue
        out.push({ cardId: cid, listTitle: l.title, accent, done })
      }
    }
    return out
  }, [state, filters])

  return (
    <div className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto max-w-container">
        <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
          <div className="min-w-[900px]">
            {/* Заголовки */}
            <div className={cn('grid items-center gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint', COLS)}>
              <span>Код</span>
              <span>Задача</span>
              <span>Список</span>
              <span>Приоритет</span>
              <span>Срок</span>
              <span className="text-right">Чек-лист</span>
              <span>Исполнители</span>
            </div>

            {rows.length === 0 && (
              <div className="border-t border-line px-5 py-10 text-center text-caption text-faint">
                Нет карточек под текущие фильтры
              </div>
            )}

            {rows.map(({ cardId, listTitle, accent, done }) => {
              const c = state.cards[cardId]
              const { done: clDone, total } = checklistProgress(c.checklists)
              const assignees = c.assigneeIds.map((id) => state.users[id]).filter(Boolean)
              const cardLabels = c.labelIds.map((id) => state.labels[id]).filter(Boolean)
              const status = dueStatus(c.dueDate, done)
              const dueColor = status === 'overdue' ? '#EF4444' : status === 'soon' ? '#F59E0B' : null
              const dueStyle: CSSProperties | undefined = c.dueDate
                ? dueColor
                  ? { color: dueColor, background: `color-mix(in srgb, ${dueColor} 14%, transparent)` }
                  : { color: 'var(--muted)', background: 'var(--hover)' }
                : undefined
              return (
                <button
                  key={cardId}
                  type="button"
                  onClick={() => onOpenCard(cardId)}
                  className={cn('grid w-full items-center gap-3 border-t border-line px-5 py-3 text-left transition-colors hover:bg-hover', COLS)}
                >
                  <span className="font-mono text-[11px] font-semibold tracking-[0.02em] text-faint">{taskCode(c)}</span>
                  <span className="min-w-0">
                    <span className={cn('block truncate text-small font-medium', done ? 'text-muted line-through' : 'text-fg')}>
                      {c.title}
                    </span>
                    {cardLabels.length > 0 && (
                      <span className="mt-0.5 block truncate text-[11px] text-faint">
                        {cardLabels.map((l) => l.name).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-caption font-medium text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: accent }} aria-hidden />
                    <span className="truncate">{listTitle}</span>
                  </span>
                  <span><PriorityFlag priority={c.priority} withLabel /></span>
                  <span>
                    {c.dueDate ? (
                      <span className="inline-flex whitespace-nowrap rounded-[8px] px-[7px] py-[3px] text-[11px] font-semibold" style={dueStyle}>
                        {formatDate(c.dueDate)}
                      </span>
                    ) : (
                      <span className="text-caption text-faint">—</span>
                    )}
                  </span>
                  <span className={cn('text-right text-caption tabular-nums', total > 0 && clDone === total ? 'text-success' : 'text-muted')}>
                    {total > 0 ? `${clDone}/${total}` : '—'}
                  </span>
                  <span>{assignees.length > 0 ? <AvatarStack users={assignees} size="sm" max={3} /> : <span className="text-caption text-faint">—</span>}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
