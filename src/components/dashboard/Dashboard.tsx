import { useMemo, type ReactNode } from 'react'
import { Menu, Sun, Moon, ListChecks, AlertTriangle, CheckCircle2, Users, type LucideIcon } from 'lucide-react'
import type { User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { isDoneList, listAccentColor } from '@/lib/design'
import { cn, dueStatus, formatDate, taskCode } from '@/lib/utils'

interface DashboardProps {
  onMenuClick: () => void
  onOpenCard?: (id: string) => void
}

// Демо-данные скорости команды (8 спринтов) — в реальной версии из API.
const SPRINTS = [
  { s: 'S-07', plan: 20, done: 18 },
  { s: 'S-08', plan: 22, done: 24 },
  { s: 'S-09', plan: 24, done: 21 },
  { s: 'S-10', plan: 23, done: 23 },
  { s: 'S-11', plan: 26, done: 28 },
  { s: 'S-12', plan: 25, done: 22 },
  { s: 'S-13', plan: 28, done: 30 },
  { s: 'S-14', plan: 27, done: 26 },
]
const ACTIVITY = [
  { who: 0, verb: 'переместил(а)', obj: 0, time: '5 мин назад' },
  { who: 1, verb: 'завершил(а)', obj: 1, time: '32 мин назад' },
  { who: 2, verb: 'прокомментировал(а)', obj: 2, time: '1 ч назад' },
  { who: 3, verb: 'назначен(а) на', obj: 3, time: '2 ч назад' },
  { who: 0, verb: 'создал(а)', obj: 4, time: 'сегодня' },
]

export function Dashboard({ onMenuClick, onOpenCard }: DashboardProps) {
  const { state } = useBoard()
  const { theme, toggle } = useTheme()

  const m = useMemo(() => {
    const { lists, cards, board, users } = state
    let total = 0
    let done = 0
    let overdue = 0
    const load: Record<string, number> = {}
    const deadlines: { id: string; title: string; due: string; overdue: boolean; accent: string; assignees: User[] }[] = []
    for (const lid of board.listIds) {
      const l = lists[lid]
      if (!l) continue
      const isDone = isDoneList(l.title)
      const accent = listAccentColor(l.title)
      for (const cid of l.cardIds) {
        const c = cards[cid]
        if (!c) continue
        total += 1
        if (isDone) {
          done += 1
          continue
        }
        for (const uid of c.assigneeIds) load[uid] = (load[uid] ?? 0) + 1
        const isOverdue = dueStatus(c.dueDate, false) === 'overdue'
        if (isOverdue) overdue += 1
        if (c.dueDate) {
          deadlines.push({
            id: c.id,
            title: c.title,
            due: c.dueDate,
            overdue: isOverdue,
            accent,
            assignees: c.assigneeIds.map((id) => users[id]).filter(Boolean),
          })
        }
      }
    }
    const active = total - done
    const members = board.memberIds.map((id) => users[id]).filter(Boolean)
    const workload = members
      .map((u) => ({ user: u, count: load[u.id] ?? 0, pct: Math.min(100, Math.round(((load[u.id] ?? 0) / 4) * 100)) }))
      .sort((a, b) => b.count - a.count)
    const avgPct = members.length ? Math.round(workload.reduce((s, w) => s + w.pct, 0) / members.length) : 0
    deadlines.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    return { total, done, active, overdue, workload, avgPct, deadlines: deadlines.slice(0, 5), members }
  }, [state])

  const maxSprint = Math.max(...SPRINTS.flatMap((x) => [x.plan, x.done]))

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.01em] text-fg">Дашборд</h1>
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
        <div className="mx-auto flex max-w-container flex-col gap-4">
          {/* Ряд KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={ListChecks} label="Активные задачи" value={m.active} delta="+6 за неделю" deltaColor="#22C55E" pct={64} barColor="#16A34A" />
            <Kpi icon={AlertTriangle} label="Просроченные" value={m.overdue} delta="требуют внимания" deltaColor="#EF4444" pct={18} barColor="#EF4444" />
            <Kpi icon={CheckCircle2} label="Выполнено за неделю" value={m.done} delta="+15%" deltaColor="#22C55E" pct={82} barColor="#22C55E" />
            <Kpi icon={Users} label="Загрузка команды" value={`${m.avgPct}%`} delta="от нормы 4 задачи" deltaColor="var(--faint)" pct={m.avgPct} barColor="#F59E0B" />
          </div>

          {/* Ряд 2: скорость + загрузка */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <Card title="Скорость команды" legend={<Legend />}>
              <div className="flex h-[168px] items-stretch gap-3.5 pt-2">
                {SPRINTS.map((sp) => {
                  const met = sp.done >= sp.plan
                  return (
                    <div key={sp.s} className="flex h-full flex-1 flex-col items-center gap-2">
                      <div className="relative flex w-full flex-1 items-end justify-center">
                        {/* план (фон) */}
                        <div className="absolute bottom-0 w-full max-w-[26px] rounded-t-[8px] bg-track" style={{ height: `${(sp.plan / maxSprint) * 100}%` }} />
                        {/* факт */}
                        <div
                          className="relative w-full max-w-[26px] rounded-t-[8px] transition-[height] duration-300"
                          style={{ height: `${(sp.done / maxSprint) * 100}%`, background: met ? '#16A34A' : 'color-mix(in srgb, #16A34A 62%, transparent)' }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-faint">{sp.s}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card title="Загрузка сотрудников">
              <div className="flex flex-col gap-3.5">
                {m.workload.map(({ user, pct }) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <Avatar user={user} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-small text-fg">{user.name}</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-pill bg-track">
                      <div className="h-full rounded-pill transition-[width] duration-300" style={{ width: `${pct}%`, background: pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#16A34A' }} />
                    </div>
                    <span className="w-9 text-right text-[11.5px] font-medium tabular-nums text-muted">{pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Ряд 3: дедлайны + активность */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
            <Card title="Ближайшие дедлайны">
              {m.deadlines.length === 0 ? (
                <Empty>Дедлайнов нет</Empty>
              ) : (
                <div className="flex flex-col">
                  {m.deadlines.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onOpenCard?.(d.id)}
                      className="flex items-center gap-3 rounded-[12px] px-2.5 py-[11px] text-left transition-colors hover:bg-hover"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: d.accent }} />
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-faint">{taskCode(d.id)}</span>
                      <span className="min-w-0 flex-1 truncate text-small text-fg">{d.title}</span>
                      <AvatarStack users={d.assignees} size="xs" max={3} />
                      <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums', d.overdue ? 'bg-error-soft text-error' : 'bg-hover text-muted')}>
                        {formatDate(d.due)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Активность" live>
              <div className="flex flex-col gap-3.5">
                {ACTIVITY.map((a, i) => {
                  const u = m.members[a.who % Math.max(1, m.members.length)]
                  const obj = m.deadlines[a.obj % Math.max(1, m.deadlines.length)]?.title ?? 'задачу'
                  if (!u) return null
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <Avatar user={u} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-small leading-[18px] text-muted">
                          <span className="font-semibold text-fg">{u.name}</span> {a.verb}{' '}
                          <span className="font-semibold text-fg">«{obj}»</span>
                        </div>
                        <div className="text-[11.5px] text-faint">{a.time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon, label, value, delta, deltaColor, pct, barColor,
}: {
  icon: LucideIcon; label: string; value: ReactNode; delta: string; deltaColor: string; pct: number; barColor: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted">{label}</span>
        <Icon size={16} strokeWidth={2} className="text-faint" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums text-fg">{value}</span>
        <span className="mb-0.5 text-[12px] font-semibold" style={{ color: deltaColor }}>{delta}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-pill bg-track">
        <div className="h-full rounded-pill transition-[width] duration-300" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function Card({ title, children, legend, live }: { title: string; children: ReactNode; legend?: ReactNode; live?: boolean }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {legend}
        {live && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-faint">
            <span className="h-1.5 w-1.5 rounded-pill bg-success" /> в реальном времени
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11.5px] text-faint">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-brand" /> Закрыто</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] bg-track" /> План</span>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-btn border border-dashed border-line py-8 text-center text-caption text-faint">{children}</div>
}
