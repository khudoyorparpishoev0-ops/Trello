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
import { cn, dueStatus, formatDate } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
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
}

export function Calendar({ onMenuClick, onOpenCard }: CalendarProps) {
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
          {/* Навигация по месяцам */}
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-h3 font-semibold text-fg">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </h2>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={goToday}
                className="mr-1 rounded-btn px-3 py-1.5 text-caption font-medium text-muted hover:bg-hover hover:text-fg"
              >
                Сегодня
              </button>
              <IconButton icon={ChevronLeft} label="Предыдущий месяц" size="sm" onClick={() => shift(-1)} />
              <IconButton icon={ChevronRight} label="Следующий месяц" size="sm" onClick={() => shift(1)} />
            </div>
          </div>

          {/* Сетка */}
          <div className="rounded-card border border-line bg-surface p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-[11px] font-semibold uppercase text-faint">
                  {w}
                </div>
              ))}
              {cells.map((d) => {
                const key = ymd(d)
                const inMonth = d.getMonth() === view.getMonth()
                const isToday = key === ymd(today)
                const isSel = key === selected
                const dl = cardsByDate[key] ?? []
                const bd = bdayByDay[mmdd(d)] ?? []
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn(
                      'flex h-12 flex-col items-center justify-start gap-1 rounded-[10px] pt-1.5 transition-colors sm:h-16',
                      isSel ? 'bg-brand-soft ring-1 ring-brand' : 'hover:bg-hover',
                      !inMonth && 'opacity-40',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-pill text-caption tabular-nums',
                        isToday ? 'bg-brand font-semibold text-white' : 'text-fg',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {dl.slice(0, 3).map((c) => {
                        const st = dueStatus(c.dueDate, cardDone[c.id] ?? false)
                        const color = st === 'overdue' ? '#EF4444' : st === 'soon' ? '#F59E0B' : st === 'done' ? '#22C55E' : '#3B82F6'
                        return <span key={c.id} className="h-1.5 w-1.5 rounded-pill" style={{ background: color }} />
                      })}
                      {bd.length > 0 && <span className="h-1.5 w-1.5 rounded-pill bg-pink-500" style={{ background: '#EC4899' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* События выбранного дня */}
          <div className="mt-5 sm:mt-6">
            <h3 className="mb-3 text-caption font-semibold uppercase tracking-wide text-muted">
              {selDate.getDate()} {MONTHS[selDate.getMonth()].toLowerCase()}
            </h3>

            {selBdays.length === 0 && selCards.length === 0 && (
              <div className="rounded-card border border-dashed border-line py-8 text-center text-caption text-faint">
                На этот день событий нет
              </div>
            )}

            <div className="flex flex-col gap-2">
              {selBdays.map((u) => (
                <div key={u.id ?? u.login} className="flex items-center gap-3 rounded-card border border-brand-border bg-brand-soft px-4 py-3">
                  <Cake size={18} strokeWidth={2} className="shrink-0 text-brand" />
                  <div className="min-w-0">
                    <div className="truncate text-small font-medium text-fg">{u.name}</div>
                    <div className="text-caption text-brand">День рождения 🎂</div>
                  </div>
                </div>
              ))}

              {selCards.map((c) => {
                const st = dueStatus(c.dueDate, cardDone[c.id] ?? false)
                const assignees = c.assigneeIds.map((id) => state.users[id]).filter(Boolean)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenCard(c.id)}
                    className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
                  >
                    <PriorityFlag priority={c.priority} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium text-fg">{c.title}</div>
                      <div
                        className={cn(
                          'text-caption',
                          st === 'overdue' ? 'text-error' : st === 'soon' ? 'text-warning' : 'text-muted',
                        )}
                      >
                        {formatDate(c.dueDate!)}
                        {st === 'overdue' && ' · просрочено'}
                      </div>
                    </div>
                    {assignees.length > 0 && <Avatar user={assignees[0]} size="sm" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
