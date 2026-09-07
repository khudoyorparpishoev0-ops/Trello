import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import type { Card } from '@/types'
import { useBoard } from '@/store/boardStore'
import { fetchUsers, type AuthUser } from '@/lib/api'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityDot } from '@/components/ui/Priority'
import { isListDone } from '@/lib/design'
import { cn, dueStatus, taskCode } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const mmdd = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

interface CalendarProps {
  onMenuClick: () => void
  onOpenCard: (cardId: string) => void
  onNavigateBoard?: () => void
}

export function Calendar({ onMenuClick, onOpenCard, onNavigateBoard }: CalendarProps) {
  const { state } = useBoard()
  const today = new Date()
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => ymd(today))
  const [users, setUsers] = useState<AuthUser[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchUsers().then((u) => !cancelled && setUsers(u))
    return () => {
      cancelled = true
    }
  }, [])

  // Готовность карточек (для подсветки просрочки)
  const cardDone = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const lid of state.board.listIds) {
      const done = isListDone(state.lists[lid])
      for (const cid of state.lists[lid].cardIds) m[cid] = done
    }
    return m
  }, [state.board.listIds, state.lists])

  const cardsByDate = useMemo(() => {
    const m: Record<string, Card[]> = {}
    for (const c of Object.values(state.cards)) {
      if (!c.dueDate) continue
      const key = ymd(new Date(c.dueDate))
      ;(m[key] ??= []).push(c)
    }
    return m
  }, [state.cards])

  const bdayByDay = useMemo(() => {
    const m: Record<string, AuthUser[]> = {}
    for (const u of users) {
      if (!u.birthday) continue
      const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(u.birthday)
      if (!mm) continue
      const key = `${mm[2]}-${mm[3]}`
      ;(m[key] ??= []).push(u)
    }
    return m
  }, [users])

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const startWeekday = (first.getDay() + 6) % 7 // понедельник = 0
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - startWeekday)
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [view])

  const selDate = new Date(selected + 'T00:00:00')
  const selCards = (cardsByDate[selected] ?? []).slice().sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const selBdays = bdayByDay[mmdd(selDate)] ?? []

  const shift = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  const goToday = () => {
    setView(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelected(ymd(today))
  }

  const monthEventCount = useMemo(() => {
    let n = 0
    for (const d of cells) {
      if (d.getMonth() !== view.getMonth()) continue
      n += (cardsByDate[ymd(d)]?.length ?? 0) + (bdayByDay[mmdd(d)]?.length ?? 0)
    }
    return n
  }, [cells, cardsByDate, bdayByDay, view])
  // Цвет события — по сроку, а не по приоритету (общее правило системы).
  const dayColor = (c: Card): string => {
    const st = dueStatus(c.dueDate, cardDone[c.id] ?? false)
    if (st === 'overdue') return 'var(--err)'
    if (st === 'soon') return 'var(--warn)'
    if (st === 'done') return 'var(--green)'
    return 'var(--info)'
  }
  const isTodaySel = selected === ymd(today)

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Планирование"
        title="Календарь"
        subtitle="Дедлайны и дни рождения по месяцам"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-container">
          {/* Панель месяца */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <IconButton icon={ChevronLeft} label="Предыдущий месяц" size="lg" bordered onClick={() => shift(-1)} />
              <IconButton icon={ChevronRight} label="Следующий месяц" size="lg" bordered onClick={() => shift(1)} />
              <button
                type="button"
                onClick={goToday}
                className="ml-2 h-11 rounded-btn border border-line px-4 text-body text-muted transition-colors hover:text-fg"
              >
                Сегодня
              </button>
            </div>
            <div className="ml-2">
              <h2 className="text-h3">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </h2>
              <p className="text-caption text-muted">{monthEventCount} событий в этом месяце</p>
            </div>
          </div>

          {/* Две колонки: сетка месяца + повестка */}
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Сетка месяца */}
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="grid grid-cols-7 border-b border-line">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="mono-label bg-mist py-3 text-center text-faint">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((d, i) => {
                    const key = ymd(d)
                    const inMonth = d.getMonth() === view.getMonth()
                    const isToday = key === ymd(today)
                    const isSel = key === selected
                    const dl = cardsByDate[key] ?? []
                    const bd = bdayByDay[mmdd(d)] ?? []
                    const events = [
                      ...dl.map((c) => ({ id: c.id, color: dayColor(c), label: c.title })),
                      ...bd.map((u) => ({ id: 'b' + (u.id ?? u.login), color: 'var(--green)', label: u.name })),
                    ]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(key)}
                        className={cn(
                          'flex min-h-[80px] flex-col gap-1 border-b border-r border-line p-2 text-left transition-colors last:border-r-0 sm:min-h-[124px]',
                          isSel && 'bg-ok-bg ring-2 ring-inset ring-brand',
                          isToday && !isSel && 'bg-ok-bg',
                          !isSel && !isToday && 'hover:bg-hover',
                          !inMonth && 'bg-mist',
                          i % 7 === 6 && 'border-r-0',
                        )}
                      >
                        <span
                          className={cn(
                            'mono-data flex h-5 shrink-0 items-center',
                            isToday ? 'text-brand-ink' : inMonth ? 'text-fg' : 'text-faint',
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {events.slice(0, 2).map((e) => (
                            <span
                              key={e.id}
                              className="hidden items-center gap-1.5 truncate border-l-2 px-1.5 py-0.5 text-caption sm:flex"
                              style={{
                                background: `color-mix(in srgb, ${e.color} 14%, transparent)`,
                                borderLeftColor: e.color,
                                color: 'var(--fg)',
                              }}
                            >
                              <span className="truncate">{e.label}</span>
                            </span>
                          ))}
                          {/* компактные точки на телефоне */}
                          <span className="flex items-center gap-0.5 sm:hidden">
                            {events.slice(0, 3).map((e) => (
                              <span key={e.id} className="h-1.5 w-1.5" style={{ background: e.color }} />
                            ))}
                          </span>
                          {events.length > 2 && (
                            <span className="mono-data hidden text-faint sm:block">+{events.length - 2}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Повестка дня */}
            <aside className="w-full shrink-0 lg:w-[320px]">
              <div className="rounded-card border border-line bg-surface p-6">
                <div className="mono-label mb-1 text-faint">
                  {isTodaySel ? 'Сегодня' : WEEKDAYS_FULL[selDate.getDay()]}
                </div>
                <h3 className="mb-5 text-h3">
                  {selDate.getDate()} {MONTHS[selDate.getMonth()].toLowerCase()}
                </h3>

                {selBdays.length === 0 && selCards.length === 0 ? (
                  <div className="rounded-chip border border-dashed border-line px-4 py-8 text-center">
                    <p className="text-body text-muted">Задач на этот день нет</p>
                    <p className="mt-1 text-caption text-faint">Выберите другой день или задайте срок задаче.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selBdays.map((u) => (
                      <div
                        key={u.id ?? u.login}
                        className="flex min-h-[56px] items-center gap-3 border-l-2 border-l-brand bg-brand-bg px-3 py-2.5"
                      >
                        <Gift size={18} strokeWidth={1.6} className="shrink-0 text-brand-ink" />
                        <div className="min-w-0">
                          <div className="truncate text-body text-fg">{u.name}</div>
                          <div className="mono-label text-brand-ink">День рождения</div>
                        </div>
                      </div>
                    ))}
                    {selCards.map((c) => {
                      const st = dueStatus(c.dueDate, cardDone[c.id] ?? false)
                      const color = dayColor(c)
                      const assignees = c.assigneeIds.map((id) => state.users[id]).filter(Boolean)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onOpenCard(c.id)}
                          className="relative flex min-h-[56px] items-center gap-3 border-l-2 bg-mist py-2.5 pl-3 pr-3 text-left transition-colors hover:bg-hover"
                          style={{ borderLeftColor: color }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="mono-data" style={{ color }}>
                                {new Date(c.dueDate!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="mono-data text-faint">{taskCode(c)}</span>
                              {st === 'overdue' && <span className="mono-data text-err-ink">ПРОСРОЧЕНО</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <PriorityDot priority={c.priority} />
                              <span className="truncate text-body text-fg">{c.title}</span>
                            </div>
                          </div>
                          {assignees.length > 0 && <Avatar user={assignees[0]} size="md" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {onNavigateBoard && (
                  <button
                    type="button"
                    onClick={onNavigateBoard}
                    className="mt-4 h-11 w-full rounded-btn border border-dashed border-line-strong text-body text-muted transition-colors hover:border-brand hover:text-fg"
                  >
                    Добавить задачу на {selDate.getDate()} {MONTHS[selDate.getMonth()].toLowerCase()}
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
