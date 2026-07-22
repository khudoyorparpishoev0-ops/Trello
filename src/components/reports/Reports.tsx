import { useMemo } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import type { Card } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityFlag } from '@/components/ui/Priority'
import { isDoneList } from '@/lib/design'
import { cn, dueStatus, formatDate } from '@/lib/utils'

const DAY = 86_400_000

interface ReportsProps {
  onMenuClick: () => void
  onOpenCard: (cardId: string) => void
}

export function Reports({ onMenuClick, onOpenCard }: ReportsProps) {
  const { state } = useBoard()
  const { theme, toggle } = useTheme()

  const data = useMemo(() => {
    const { board, lists, cards, users } = state
    const doneByCard: Record<string, boolean> = {}
    for (const lid of board.listIds) {
      const done = isDoneList(lists[lid].title)
      for (const cid of lists[lid].cardIds) doneByCard[cid] = done
    }
    const all = Object.values(cards)
    const now = Date.now()

    // Общая сводка
    let total = 0
    let done = 0
    let overdue = 0
    for (const c of all) {
      total += 1
      if (doneByCard[c.id]) done += 1
      else if (dueStatus(c.dueDate, false) === 'overdue') overdue += 1
    }

    // По сотрудникам
    const perUser = board.memberIds
      .map((uid) => {
        const u = users[uid]
        let t = 0
        let d = 0
        let ov = 0
        for (const c of all) {
          if (!c.assigneeIds.includes(uid)) continue
          t += 1
          if (doneByCard[c.id]) d += 1
          else if (dueStatus(c.dueDate, false) === 'overdue') ov += 1
        }
        return { user: u, total: t, active: t - d, done: d, overdue: ov, pct: t ? Math.round((d / t) * 100) : 0 }
      })
      .filter((r) => r.user && r.total > 0)
      .sort((a, b) => b.total - a.total)

    // Просроченные и ближайшие
    const overdueCards = all
      .filter((c) => !doneByCard[c.id] && dueStatus(c.dueDate, false) === 'overdue')
      .map((c) => ({ card: c, days: Math.floor((now - new Date(c.dueDate!).getTime()) / DAY) }))
      .sort((a, b) => b.days - a.days)

    const upcoming = all
      .filter((c) => {
        if (doneByCard[c.id] || !c.dueDate) return false
        const diff = new Date(c.dueDate).getTime() - now
        return diff >= 0 && diff <= 7 * DAY
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

    return { total, done, active: total - done, overdue, perUser, overdueCards, upcoming, completion: total ? Math.round((done / total) * 100) : 0 }
  }, [state])

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <h1 className="truncate text-h3 font-semibold text-fg">Отчёты</h1>
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
          {/* Общая сводка */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-4 sm:gap-4">
            <Stat label="Всего задач" value={data.total} />
            <Stat label="Готово" value={data.done} accent="#22C55E" />
            <Stat label="Просрочено" value={data.overdue} accent={data.overdue ? '#EF4444' : undefined} />
            <Stat label="Выполнение" value={`${data.completion}%`} accent="#16A34A" />
          </div>

          {/* По сотрудникам */}
          <Section title="Сводка по сотрудникам">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse text-small">
                <thead>
                  <tr className="text-left text-caption uppercase tracking-wide text-faint">
                    <th className="px-2 py-2 font-semibold">Сотрудник</th>
                    <th className="px-2 py-2 text-right font-semibold">Всего</th>
                    <th className="px-2 py-2 text-right font-semibold">В работе</th>
                    <th className="px-2 py-2 text-right font-semibold">Готово</th>
                    <th className="px-2 py-2 text-right font-semibold">Просроч.</th>
                    <th className="px-2 py-2 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perUser.map((r) => (
                    <tr key={r.user.id} className="border-t border-line">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar user={r.user} size="sm" />
                          <span className="truncate text-fg">{r.user.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{r.total}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{r.active}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-success">{r.done}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', r.overdue ? 'text-error' : 'text-faint')}>
                        {r.overdue}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium text-fg">{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Просроченные */}
          <Section title={`Просроченные задачи · ${data.overdueCards.length}`} className="mt-5 sm:mt-6">
            {data.overdueCards.length === 0 ? (
              <Empty>Просроченных задач нет 🎉</Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.overdueCards.map(({ card, days }) => (
                  <TaskRow key={card.id} card={card} users={state.users} onOpen={() => onOpenCard(card.id)}>
                    <span className="shrink-0 rounded-pill bg-error-soft px-2 py-0.5 text-caption font-medium text-error">
                      {days === 0 ? 'сегодня' : `−${days} дн.`}
                    </span>
                  </TaskRow>
                ))}
              </div>
            )}
          </Section>

          {/* Ближайшие дедлайны */}
          <Section title="Ближайшие дедлайны · 7 дней" className="mt-5 sm:mt-6">
            {data.upcoming.length === 0 ? (
              <Empty>На ближайшую неделю дедлайнов нет</Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.upcoming.map((card) => (
                  <TaskRow key={card.id} card={card} users={state.users} onOpen={() => onOpenCard(card.id)}>
                    <span className="shrink-0 rounded-pill bg-hover px-2 py-0.5 text-caption font-medium text-muted">
                      {formatDate(card.dueDate!)}
                    </span>
                  </TaskRow>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-sm">
      <div className="text-h2 font-bold leading-none" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-1.5 text-caption text-muted">{label}</div>
    </div>
  )
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-btn border border-dashed border-line py-6 text-center text-caption text-faint">
      {children}
    </div>
  )
}

function TaskRow({
  card,
  users,
  onOpen,
  children,
}: {
  card: Card
  users: Record<string, { id: string; name: string; initials: string; color: string }>
  onOpen: () => void
  children: React.ReactNode
}) {
  const assignee = card.assigneeIds.map((id) => users[id]).filter(Boolean)[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-input border border-line bg-bg px-3 py-2 text-left transition-colors hover:border-line-strong"
    >
      <PriorityFlag priority={card.priority} />
      <span className="min-w-0 flex-1 truncate text-small text-fg">{card.title}</span>
      {assignee && <Avatar user={assignee} size="sm" />}
      {children}
    </button>
  )
}
