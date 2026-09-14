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
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-container">
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <div className="min-w-[900px]">
            {/* Заголовки */}
            <div className={cn('mono-label grid items-center gap-3 bg-mist px-6 py-3 text-faint', COLS)}>
              <span>Код</span>
              <span>Задача</span>
              <span>Список</span>
              <span>Приоритет</span>
              <span>Срок</span>
              <span className="text-right">Чек-лист</span>
              <span>Исполнители</span>
            </div>

            {rows.length === 0 && (
              <div className="border-t border-line px-6 py-12 text-center">
                <p className="text-body text-muted">Нет карточек под текущие фильтры</p>
                <p className="mt-1 text-caption text-faint">Снимите фильтр «Мои карточки» или «Просрочено».</p>
              </div>
            )}

            {rows.map(({ cardId, listTitle, accent, done }) => {
              const c = state.cards[cardId]
              const { done: clDone, total } = checklistProgress(c.checklists)
              const assignees = c.assigneeIds.map((id) => state.users[id]).filter(Boolean)
              const cardLabels = c.labelIds.map((id) => state.labels[id]).filter(Boolean)
              // Цвет срока — по сроку, а не по приоритету.
              const status = dueStatus(c.dueDate, done)
              const dueStyle: CSSProperties | undefined =
                status === 'overdue'
                  ? { color: 'var(--err-ink)', background: 'var(--err-bg)' }
                  : status === 'soon'
                    ? { color: 'var(--warn-ink)', background: 'var(--warn-bg)' }
                    : { color: 'var(--muted)', background: 'var(--mist)' }
              return (
                <button
                  key={cardId}
                  type="button"
                  onClick={() => onOpenCard(cardId)}
                  className={cn('grid min-h-[56px] w-full items-center gap-3 border-t border-line px-6 py-3 text-left transition-colors hover:bg-hover', COLS)}
                >
                  <span className="mono-data text-muted">{taskCode(c)}</span>
                  <span className="min-w-0">
                    <span className={cn('block truncate text-body', done ? 'text-muted line-through' : 'text-fg')}>
                      {c.title}
                    </span>
                    {cardLabels.length > 0 && (
                      <span className="mono-data mt-0.5 block truncate text-faint">
                        {cardLabels.map((l) => l.name).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2 text-caption text-muted">
                    <span className="h-2 w-2 shrink-0" style={{ background: accent }} aria-hidden />
                    <span className="truncate">{listTitle}</span>
                  </span>
                  <span><PriorityFlag priority={c.priority} withLabel /></span>
                  <span>
                    {c.dueDate ? (
                      <span className="mono-data inline-flex whitespace-nowrap px-2 py-1" style={dueStyle}>
                        {formatDate(c.dueDate).toUpperCase()}
                      </span>
                    ) : (
                      <span className="mono-data text-faint">СРОКА НЕТ</span>
                    )}
                  </span>
                  <span className={cn('mono-data text-right', total > 0 && clDone === total ? 'text-ok-ink' : 'text-muted')}>
                    {total > 0 ? `${clDone}/${total}` : '—'}
                  </span>
                  <span>{assignees.length > 0 ? <AvatarStack users={assignees} size="sm" max={3} /> : <span className="mono-data text-faint">—</span>}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
