import { useMemo, type ReactNode } from 'react'
import type { Card } from '@/types'
import { useBoard } from '@/store/boardStore'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Badge'
import { PriorityDot } from '@/components/ui/Priority'
import { isListDone } from '@/lib/design'
import { cn, dueStatus, formatDate, taskCode } from '@/lib/utils'

const DAY = 86_400_000

interface ReportsProps {
  onMenuClick: () => void
  onOpenCard: (cardId: string) => void
}

export function Reports({ onMenuClick, onOpenCard }: ReportsProps) {
  const { state } = useBoard()

  const data = useMemo(() => {
    const { board, lists, cards, users } = state
    const doneByCard: Record<string, boolean> = {}
    for (const lid of board.listIds) {
      const done = isListDone(lists[lid])
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
      <ScreenHeader
        kicker="Аналитика"
        title="Отчёты"
        subtitle="Сводка по задачам и сотрудникам за период"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-narrow flex-col gap-6">
          {/* Общая сводка */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Всего задач" value={data.total} />
            <Stat label="Готово" value={data.done} tone="ok" />
            <Stat label="Просрочено" value={data.overdue} tone={data.overdue ? 'err' : 'muted'} />
            <Stat label="Выполнение" value={`${data.completion}%`} tone="brand" />
          </div>

          {/* По сотрудникам */}
          <Section title="Сводка по сотрудникам">
            {data.perUser.length === 0 ? (
              <Empty>Задачи ещё никому не назначены</Empty>
            ) : (
              <div className="-mx-6 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="mono-label border-b border-line text-left text-faint">
                      <th className="px-6 pb-3 font-semibold">Сотрудник</th>
                      <th className="px-3 pb-3 text-right font-semibold">Всего</th>
                      <th className="px-3 pb-3 text-right font-semibold">В работе</th>
                      <th className="px-3 pb-3 text-right font-semibold">Готово</th>
                      <th className="px-3 pb-3 text-right font-semibold">Просроч.</th>
                      <th className="px-6 pb-3 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perUser.map((r) => (
                      <tr key={r.user.id} className="h-11 border-b border-line last:border-0">
                        <td className="px-6">
                          <span className="flex items-center gap-3">
                            <Avatar user={r.user} size="md" />
                            <span className="truncate text-body text-fg">{r.user.name}</span>
                          </span>
                        </td>
                        <td className="mono-data px-3 text-right text-muted">{r.total}</td>
                        <td className="mono-data px-3 text-right text-muted">{r.active}</td>
                        <td className={cn('mono-data px-3 text-right', r.done ? 'text-ok-ink' : 'text-faint')}>
                          {r.done}
                        </td>
                        <td className={cn('mono-data px-3 text-right', r.overdue ? 'text-err-ink' : 'text-faint')}>
                          {r.overdue}
                        </td>
                        <td className="mono-data px-6 text-right text-fg">{r.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Просроченные */}
          <Section title={`Просроченные задачи · ${data.overdueCards.length}`}>
            {data.overdueCards.length === 0 ? (
              <Empty>Просроченных задач нет</Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.overdueCards.map(({ card, days }) => (
                  <TaskRow key={card.id} card={card} users={state.users} onOpen={() => onOpenCard(card.id)}>
                    <Pill tone="err" rule>
                      {days === 0 ? 'сегодня' : `${days} дн.`}
                    </Pill>
                  </TaskRow>
                ))}
              </div>
            )}
          </Section>

          {/* Ближайшие дедлайны */}
          <Section title="Ближайшие дедлайны · 7 дней">
            {data.upcoming.length === 0 ? (
              <Empty>На ближайшую неделю дедлайнов нет</Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.upcoming.map((card) => (
                  <TaskRow key={card.id} card={card} users={state.users} onOpen={() => onOpenCard(card.id)}>
                    <span className="mono-data shrink-0 bg-mist px-2 py-1 text-muted">
                      {formatDate(card.dueDate!).toUpperCase()}
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

const TONE_INK: Record<string, string> = {
  brand: 'text-brand-ink',
  ok: 'text-ok-ink',
  err: 'text-err-ink',
  muted: 'text-fg',
}

function Stat({
  label,
  value,
  tone = 'muted',
}: {
  label: string
  value: number | string
  tone?: 'brand' | 'ok' | 'err' | 'muted'
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <p className={cn('mono-data text-[36px] leading-[40px]', TONE_INK[tone])}>{value}</p>
      <p className="mt-1 text-caption text-muted">{label}</p>
    </section>
  )
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-6', className)}>
      <h2 className="mono-label mb-4 text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-chip border border-dashed border-line px-4 py-8 text-center text-body text-muted">
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
  children: ReactNode
}) {
  const assignee = card.assigneeIds.map((id) => users[id]).filter(Boolean)[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] items-center gap-3 rounded-chip border border-line bg-mist px-3 py-2 text-left transition-colors hover:border-line-strong"
    >
      <PriorityDot priority={card.priority} />
      <span className="mono-data shrink-0 text-faint">{taskCode(card)}</span>
      <span className="min-w-0 flex-1 truncate text-body text-fg">{card.title}</span>
      {assignee && <Avatar user={assignee} size="md" />}
      {children}
    </button>
  )
}
