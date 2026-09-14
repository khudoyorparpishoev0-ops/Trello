import { useMemo, type ReactNode } from 'react'
import { useBoard } from '@/store/boardStore'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Badge'
import { PriorityDot } from '@/components/ui/Priority'
import { cn, formatDate, taskCode } from '@/lib/utils'
import {
  getEmployeeMetrics,
  getOverdueTasks,
  getProjectMetrics,
  getUpcomingDeadlines,
  type TaskRef,
} from '@/analytics'
import { useAnalytics } from '@/analytics/useAnalytics'

interface ReportsProps {
  onMenuClick: () => void
  onOpenCard: (cardId: string) => void
}

export function Reports({ onMenuClick, onOpenCard }: ReportsProps) {
  const { state } = useBoard()

  const ix = useAnalytics()
  const boardId = state.board?.id ?? ''

  /**
   * Отчёт ничего не считает сам: и сводка, и разрез по сотрудникам, и списки
   * задач приходят из слоя аналитики. Один показатель — один источник расчёта.
   */
  const data = useMemo(() => {
    const scope = { boardId }
    const project = getProjectMetrics(ix, boardId)
    const counts = project?.counts ?? { total: 0, done: 0, active: 0, overdue: 0, dueSoon: 0, unassigned: 0, noDueDate: 0 }

    const perUser = (state.board?.memberIds ?? [])
      .map((uid) => ({ uid, m: getEmployeeMetrics(ix, uid, scope) }))
      .filter((r): r is { uid: string; m: NonNullable<ReturnType<typeof getEmployeeMetrics>> } => r.m !== null)
      .map(({ uid, m }) => ({
        user: state.users[uid],
        total: m.counts.total,
        active: m.counts.active,
        done: m.counts.done,
        overdue: m.counts.overdue,
        pct: m.completion,
      }))
      .filter((r) => r.user && r.total > 0)
      .sort((a, b) => b.total - a.total)

    return {
      total: counts.total,
      done: counts.done,
      active: counts.active,
      overdue: counts.overdue,
      completion: project?.completion ?? 0,
      perUser,
      overdueCards: getOverdueTasks(ix, scope),
      upcoming: getUpcomingDeadlines(ix, scope, 7),
    }
  }, [ix, boardId, state.board, state.users])

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
                {data.overdueCards.map((task) => (
                  <TaskRow
                    key={task.cardId}
                    task={task}
                    users={state.users}
                    onOpen={() => onOpenCard(task.cardId)}
                  >
                    <Pill tone="err" rule>
                      {task.overdueDays === 0 ? 'сегодня' : `${task.overdueDays} дн.`}
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
                {data.upcoming.map((task) => (
                  <TaskRow
                    key={task.cardId}
                    task={task}
                    users={state.users}
                    onOpen={() => onOpenCard(task.cardId)}
                  >
                    <span className="mono-data shrink-0 bg-mist px-2 py-1 text-muted">
                      {formatDate(task.dueDate as string).toUpperCase()}
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
  task,
  users,
  onOpen,
  children,
}: {
  task: TaskRef
  users: Record<string, { id: string; name: string; initials: string; color: string }>
  onOpen: () => void
  children: ReactNode
}) {
  const assignee = task.assigneeIds.map((id) => users[id]).filter(Boolean)[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] items-center gap-3 rounded-chip border border-line bg-mist px-3 py-2 text-left transition-colors hover:border-line-strong"
    >
      <PriorityDot priority={task.priority} />
      <span className="mono-data shrink-0 text-faint">
        {taskCode({ id: task.cardId, code: task.code })}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-fg">{task.title}</span>
      {assignee && <Avatar user={assignee} size="md" />}
      {children}
    </button>
  )
}
