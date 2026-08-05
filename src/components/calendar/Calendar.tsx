import { useEffect, useMemo, useState } from 'react'
import { Menu, Sun, Moon, ChevronLeft, ChevronRight, Cake } from 'lucide-react'
import type { Card } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { fetchUsers, type AuthUser } from '@/lib/api'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityFlag } from '@/components/ui/Priority'
import { isDoneList } from '@/lib/design'
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
  const { theme, toggle } = useTheme()
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
      const done = isDoneList(state.lists[lid].title)
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
  const dayColor = (c: Card): string => {
    const st = dueStatus(c.dueDate, cardDone[c.id] ?? false)
    return st === 'overdue' ? '#EF4444' : st === 'soon' ? '#F59E0B' : st === 'done' ? '#22C55E' : '#3B82F6'
  }
  const isTodaySel = selected === ymd(today)

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <h1 className="truncate text-h3 font-semibold text-fg">Календарь</h1>
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            size="sm"
            onClick={toggle}
            className="ml-auto"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-container">
          {/* Шапка календаря */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-fg">
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </h2>
              <p className="text-[12.5px] text-faint">{monthEventCount} событий в этом месяце</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={goToday}
                className="mr-1 h-[34px] rounded-[12px] px-3 text-caption font-medium text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                Сегодня
              </button>
              <IconButton icon={ChevronLeft} label="Предыдущий месяц" size="sm" onClick={() => shift(-1)} />
              <IconButton icon={ChevronRight} label="Следующий месяц" size="sm" onClick={() => shift(1)} />
            </div>
          </div>

          {/* Две колонки: сетка месяца + повестка */}
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Сетка месяца */}
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <div className="grid grid-cols-7 border-b border-line">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
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
                      ...bd.map((u) => ({ id: 'b' + (u.id ?? u.login), color: '#EC4899', label: u.name })),
                    ]
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(key)}
                        className={cn(
                          'flex min-h-[68px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors last:border-r-0 sm:min-h-[92px]',
                          isSel ? 'bg-brand-soft ring-1 ring-inset ring-brand' : 'hover:bg-hover',
                          !inMonth && 'bg-[color-mix(in_srgb,var(--faint)_5%,transparent)]',
                          i % 7 === 6 && 'border-r-0',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-caption tabular-nums',
                            isToday ? 'bg-brand font-semibold text-white' : inMonth ? 'text-fg' : 'text-faint',
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {events.slice(0, 2).map((e) => (
                            <span
                              key={e.id}
                              className="hidden items-center gap-1 truncate rounded-[4px] px-1 py-[1px] text-[10px] leading-[14px] sm:flex"
                              style={{ background: `color-mix(in srgb, ${e.color} 15%, transparent)`, color: e.color }}
                            >
                              <span className="h-[5px] w-[5px] shrink-0 rounded-pill" style={{ background: e.color }} />
                              <span className="truncate">{e.label}</span>
                            </span>
                          ))}
                          {/* компактные точки на телефоне */}
                          <span className="flex items-center gap-0.5 sm:hidden">
                            {events.slice(0, 3).map((e) => (
                              <span key={e.id} className="h-1.5 w-1.5 rounded-pill" style={{ background: e.color }} />
                            ))}
                          </span>
                          {events.length > 2 && (
                            <span className="hidden text-[10px] font-medium text-faint sm:block">+{events.length - 2}</span>
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
              <div className="rounded-card border border-line bg-surface p-4">
                <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {isTodaySel ? 'Сегодня' : WEEKDAYS_FULL[selDate.getDay()]}
                </div>
                <div className="mb-4 text-[15px] font-semibold text-fg">
                  {selDate.getDate()} {MONTHS[selDate.getMonth()].toLowerCase()}
                </div>

                {selBdays.length === 0 && selCards.length === 0 ? (
                  <div className="rounded-input border border-dashed border-line py-8 text-center text-caption text-faint">
                    Задач на этот день нет
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selBdays.map((u) => (
                      <div key={u.id ?? u.login} className="flex items-center gap-3 rounded-card border border-brand-border bg-brand-soft px-3 py-2.5">
                        <Cake size={18} strokeWidth={2} className="shrink-0 text-brand" />
                        <div className="min-w-0">
                          <div className="truncate text-small font-medium text-fg">{u.name}</div>
                          <div className="text-caption text-brand">День рождения 🎂</div>
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
                          className="relative flex items-center gap-2.5 overflow-hidden rounded-card border border-line bg-col py-2.5 pl-4 pr-3 text-left transition-colors hover:border-line-strong"
                        >
                          <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-pill" style={{ background: color }} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="text-[12.5px] font-semibold" style={{ color }}>
                                {new Date(c.dueDate!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="font-mono text-[11px] font-semibold text-faint">{taskCode(c.id)}</span>
                              {st === 'overdue' && <span className="text-[11px] font-medium text-error">просрочено</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <PriorityFlag priority={c.priority} />
                              <span className="truncate text-small font-medium text-fg">{c.title}</span>
                            </div>
                          </div>
                          {assignees.length > 0 && <Avatar user={assignees[0]} size="sm" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {onNavigateBoard && (
                  <button
                    type="button"
                    onClick={onNavigateBoard}
                    className="mt-3 w-full rounded-btn border border-dashed border-line-strong py-2.5 text-caption font-medium text-muted transition-colors hover:border-brand hover:text-fg"
                  >
                    Задача на этот день
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
