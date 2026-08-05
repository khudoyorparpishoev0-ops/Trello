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

// «Скорость по отделам» (ТЗ «Диаграмма по отделам» §3): закрытые задачи за
// месяц и план по отделам. Значения — демо (в реальной версии из API);
// короткая подпись задаётся в данных, не вычисляется обрезкой.
const DEPT_STATS: Record<string, { short?: string; v: number; plan: number }> = {
  'Проектирование': { short: 'Проект.', v: 18, plan: 24 },
  'Монтаж': { v: 21, plan: 24 },
  'ПТО': { v: 16, plan: 22 },
  'Снабжение': { short: 'Снабж.', v: 24, plan: 26 },
  'IT-отдел': { short: 'IT', v: 27, plan: 26 },
  'Сервис': { v: 22, plan: 28 },
  'Склад': { v: 29, plan: 28 },
  'Администрация': { short: 'Админ.', v: 23, plan: 30 },
}

// Читаемые сокращения для прежнего состава справочника (существующие данные).
const LEGACY_SHORT: Record<string, string> = {
  'Стратегического планирования': 'Стратег.',
  'Информационных технологий (IT)': 'IT',
  'Закупок и снабжения': 'Снабж.',
  'Отдел проектирования': 'Проект.',
  'Производственный отдел': 'Производ.',
  'Финансовый отдел': 'Финансы',
}

/** Демо-показатели отдела: спековые значения либо детерминированные из названия. */
function deptStat(name: string): { s: string; short: string; v: number; plan: number } {
  const known = DEPT_STATS[name]
  if (known) return { s: name, short: known.short ?? name, v: known.v, plan: known.plan }
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return { s: name, short: LEGACY_SHORT[name] ?? name, v: 14 + (h % 15), plan: 18 + ((h >> 3) % 13) }
}
const ACTIVITY = [
  { who: 0, verb: 'переместил(а)', obj: 0, time: '5 мин назад' },
  { who: 1, verb: 'завершил(а)', obj: 1, time: '32 мин назад' },
  { who: 2, verb: 'прокомментировал(а)', obj: 2, time: '1 ч назад' },
  { who: 3, verb: 'назначен(а) на', obj: 3, time: '2 ч назад' },
  { who: 0, verb: 'создал(а)', obj: 4, time: 'сегодня' },
]

export function Dashboard({ onMenuClick, onOpenCard }: DashboardProps) {
  const { state, departments } = useBoard()
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

  // Отделы — из справочника раздела «Компания»: добавленный отдел появляется
  // в диаграмме. Максимум считается по всем значениям, включая планы.
  const depts = useMemo(() => departments.map(deptStat), [departments])
  const maxDept = Math.max(1, ...depts.flatMap((d) => [d.v, d.plan]))

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
            <Card
              title="Скорость по отделам"
              sub="Закрытых задач за месяц · план и факт по отделам"
              legend={<Legend />}
            >
              <div className="flex h-[168px] items-stretch gap-3.5">
                {depts.map((d) => {
                  const met = d.v >= d.plan
                  return (
                    <div key={d.s} className="flex h-full min-w-0 flex-1 flex-col items-stretch gap-2">
                      {/* Зона столбцов — ФИКСИРОВАННАЯ высота (ТЗ §2.1): flex:1 здесь
                          нельзя — многострочные подписи съедали бы высоту по-разному,
                          нулевые линии разъехались бы и проценты начали бы врать. */}
                      <div className="relative flex h-[132px] w-full flex-none items-end justify-center">
                        {/* план (фон) */}
                        <div
                          className="absolute bottom-0 w-full max-w-[38px] rounded-t-[8px] bg-track"
                          style={{ height: `${Math.round((d.plan / maxDept) * 100)}%` }}
                        />
                        {/* факт */}
                        <div
                          className="relative w-full max-w-[38px] rounded-t-[8px] transition-[height] duration-300 ease-smooth"
                          style={{
                            height: `${Math.round((d.v / maxDept) * 100)}%`,
                            background: met ? '#16A34A' : 'color-mix(in srgb, #16A34A 62%, transparent)',
                          }}
                        />
                      </div>
                      {/* Подпись — отдельной строкой ПОД зоной; width:100%, одна строка
                          с многоточием, без overflow-wrap: anywhere (ТЗ §2.2). */}
                      <span
                        title={d.s}
                        className="w-full flex-none truncate text-center text-[11px] font-medium leading-[14px] text-faint"
                      >
                        {d.short}
                      </span>
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

function Card({ title, sub, children, legend, live }: { title: string; sub?: string; children: ReactNode; legend?: ReactNode; live?: boolean }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
          {sub && <span className="text-[12px] text-muted">{sub}</span>}
        </div>
        {legend}
        {live && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-faint">
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
    <div className="flex shrink-0 items-center gap-3.5 text-[11.5px] font-medium text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-brand" /> Закрыто</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px] bg-track" /> План</span>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-btn border border-dashed border-line py-8 text-center text-caption text-faint">{children}</div>
}
