import { useMemo } from 'react'
import type { Filters } from './Board'
import { useBoard } from '@/store/boardStore'
import { isListDone, listAccentColor } from '@/lib/design'
import { cardMatchesFilters } from '@/lib/filterCards'
import { cn, taskCode } from '@/lib/utils'

interface TimelineProps {
  filters: Filters
  onOpenCard: (cardId: string) => void
}

const DAY_MS = 24 * 3600 * 1000
const DAY_W = 34 // ширина дня, px
const LEFT_W = 240 // левая колонка с названием
const DAYS_BACK = 7
const DAYS_FWD = 21
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** Вид «Таймлайн»: полосы задач по срокам (создание/начало → дедлайн). */
export function Timeline({ filters, onOpenCard }: TimelineProps) {
  const { state } = useBoard()

  const t0 = new Date()
  t0.setHours(0, 0, 0, 0)
  const rangeStart = t0.getTime() - DAYS_BACK * DAY_MS
  const totalDays = DAYS_BACK + DAYS_FWD + 1
  const days = Array.from({ length: totalDays }, (_, i) => new Date(rangeStart + i * DAY_MS))

  const { rows, hidden } = useMemo(() => {
    const out: {
      cardId: string
      code?: number
      title: string
      accent: string
      overdue: boolean
      done: boolean
      startIdx: number
      endIdx: number
    }[] = []
    let hiddenCount = 0
    const now = Date.now()
    for (const lid of state.board.listIds) {
      const l = state.lists[lid]
      if (!l) continue
      const accent = l.color || listAccentColor(l.title)
      const done = isListDone(l)
      for (const cid of l.cardIds) {
        const c = state.cards[cid]
        if (!c || !cardMatchesFilters(c, l, state, filters)) continue
        if (!c.dueDate) {
          hiddenCount++
          continue
        }
        const start = new Date(c.startDate ?? c.createdAt).getTime()
        const end = new Date(c.dueDate).getTime()
        const s = Math.min(start, end)
        // Индексы дней, обрезанные диапазоном окна
        const startIdx = Math.max(0, Math.floor((s - rangeStart) / DAY_MS))
        const endIdx = Math.min(totalDays - 1, Math.floor((end - rangeStart) / DAY_MS))
        if (endIdx < 0 || startIdx > totalDays - 1) {
          hiddenCount++
          continue
        }
        out.push({ cardId: cid, code: c.code, title: c.title, accent, overdue: !done && end < now, done, startIdx, endIdx: Math.max(endIdx, startIdx) })
      }
    }
    return { rows: out, hidden: hiddenCount }
  }, [state, filters, rangeStart, totalDays])

  const todayIdx = DAYS_BACK
  const contentW = LEFT_W + totalDays * DAY_W

  return (
    <div className="h-full overflow-auto">
      <div className="relative" style={{ width: contentW, minWidth: '100%' }}>
        {/* Шапка с днями */}
        <div className="sticky top-0 z-20 flex border-b border-line bg-mist">
          <div
            className="mono-label sticky left-0 z-10 shrink-0 border-r border-line bg-mist px-4 py-3 text-faint"
            style={{ width: LEFT_W }}
          >
            Задача
          </div>
          {days.map((d, i) => {
            const weekend = d.getDay() === 0 || d.getDay() === 6
            const isToday = i === todayIdx
            return (
              <div
                key={i}
                style={{ width: DAY_W }}
                className={cn(
                  'mono-data shrink-0 py-3 text-center',
                  weekend && 'bg-hover',
                  isToday ? 'text-brand-ink' : 'text-faint',
                )}
              >
                {d.getDate() === 1 || i === 0 ? (
                  <span className="block leading-none">
                    {d.getDate()}
                    <span className="mt-0.5 block text-[9px] uppercase">{MONTHS[d.getMonth()]}</span>
                  </span>
                ) : (
                  d.getDate()
                )}
              </div>
            )
          })}
        </div>

        {/* Линия «сегодня» */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-[41px] z-10 w-px bg-brand"
          style={{ left: LEFT_W + todayIdx * DAY_W + DAY_W / 2 }}
        />

        {/* Строки */}
        {rows.map((r) => (
          <button
            key={r.cardId}
            type="button"
            onClick={() => onOpenCard(r.cardId)}
            className="group flex w-full border-b border-line text-left transition-colors hover:bg-hover"
          >
            <span
              className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-page px-4 py-3 group-hover:bg-hover"
              style={{ width: LEFT_W }}
            >
              <span className="h-2 w-2 shrink-0" style={{ background: r.accent }} aria-hidden />
              <span className="mono-data shrink-0 text-faint">{taskCode({ id: r.cardId, code: r.code })}</span>
              <span className={cn('min-w-0 truncate text-caption', r.done ? 'text-muted line-through' : 'text-fg')}>
                {r.title}
              </span>
            </span>
            <span className="relative block h-10 shrink-0" style={{ width: totalDays * DAY_W }}>
              <span
                className="absolute top-1/2 h-4 -translate-y-1/2 rounded-chip transition-opacity group-hover:opacity-100"
                style={{
                  left: r.startIdx * DAY_W + 3,
                  width: (r.endIdx - r.startIdx + 1) * DAY_W - 6,
                  background: r.overdue ? 'var(--err)' : r.accent,
                  opacity: r.done ? 0.45 : 0.9,
                }}
              />
            </span>
          </button>
        ))}

        {rows.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-body text-muted">Нет задач со сроком в окне таймлайна</p>
            <p className="mt-1 text-caption text-faint">Окно — неделя назад и три недели вперёд.</p>
          </div>
        )}

        {hidden > 0 && (
          <div className="sticky left-0 px-6 py-3 text-caption text-faint" style={{ maxWidth: '100vw' }}>
            Без срока или вне окна: {hidden} задач(и) — не показаны. Задайте срок, чтобы они появились на таймлайне.
          </div>
        )}
      </div>
    </div>
  )
}
