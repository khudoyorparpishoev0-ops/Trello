import { useMemo, type ReactNode } from 'react'
import {
  Menu,
  Sun,
  Moon,
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { PRIORITY_META, PRIORITY_ORDER, isDoneList, listAccentColor } from '@/lib/design'
import { cn, dueStatus } from '@/lib/utils'

interface DashboardProps {
  onMenuClick: () => void
}

/** Дашборд IT-HONA (Brand Book §8): крупные KPI, много воздуха, зелёный акцент на ключевом. */
export function Dashboard({ onMenuClick }: DashboardProps) {
  const { state } = useBoard()
  const { theme, toggle } = useTheme()

  const m = useMemo(() => {
    const { lists, cards, board, users, workspace } = state
    const listIds = board.listIds
    let total = 0
    let done = 0
    let overdue = 0
    const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    const load: Record<string, number> = {}
    const byList = listIds.map((lid) => {
      const l = lists[lid]
      const isDone = isDoneList(l.title)
      for (const cid of l.cardIds) {
        const c = cards[cid]
        if (!c) continue
        total += 1
        if (isDone) {
          done += 1
        } else {
          byPriority[c.priority] = (byPriority[c.priority] ?? 0) + 1
          for (const uid of c.assigneeIds) load[uid] = (load[uid] ?? 0) + 1
          if (dueStatus(c.dueDate, false) === 'overdue') overdue += 1
        }
      }
      return { title: l.title, count: l.cardIds.length, accent: listAccentColor(l.title) }
    })
    const active = total - done
    const members = board.memberIds.map((id) => users[id]).filter(Boolean)
    const workload = members
      .map((u) => ({ user: u, count: load[u.id] ?? 0 }))
      .sort((a, b) => b.count - a.count)
    const maxLoad = Math.max(1, ...workload.map((w) => w.count))
    const completion = total ? Math.round((done / total) * 100) : 0
    const avgLoad = members.length ? Math.round((active / members.length) * 10) / 10 : 0
    const maxList = Math.max(1, ...byList.map((b) => b.count))
    return {
      projects: workspace.boards.length,
      total,
      done,
      active,
      overdue,
      completion,
      avgLoad,
      workload,
      maxLoad,
      byPriority,
      byList,
      maxList,
    }
  }, [state])

  return (
    <div className="flex h-full flex-col">
      {/* Шапка */}
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton
            icon={Menu}
            label="Меню"
            size="sm"
            onClick={onMenuClick}
            className="-ml-1 shrink-0 lg:hidden"
          />
          <div className="min-w-0">
            <h1 className="truncate text-h3 font-semibold text-fg">Дашборд</h1>
            <p className="hidden text-caption text-faint sm:block">
              {state.workspace.name} · {state.board.name}
            </p>
          </div>
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            size="sm"
            onClick={toggle}
            className="ml-auto"
          />
        </div>
      </header>

      {/* Контент */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-container">
          {/* KPI-блоки (Brand Book §8) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Kpi icon={FolderKanban} label="Активные проекты" value={m.projects} />
            <Kpi
              icon={AlertTriangle}
              label="Просроченные задачи"
              value={m.overdue}
              accent={m.overdue > 0 ? '#EF4444' : undefined}
            />
            <Kpi icon={CheckCircle2} label="Выполнено" value={m.done} accent="#16A34A" caption="карточек в «Готово»" />
            <Kpi icon={Users} label="Загруженность" value={m.avgLoad} caption="активных задач на человека" />
            <Kpi
              icon={TrendingUp}
              label="Производительность"
              value={`${m.completion}%`}
              accent="#16A34A"
              caption="доска выполнена"
            />
            <Kpi icon={Wallet} label="Финансы" value="76%" caption="освоение бюджета" badge="демо" />
          </div>

          {/* Загруженность команды */}
          <Section title="Загруженность команды" className="mt-5 sm:mt-6">
            <div className="flex flex-col gap-3">
              {m.workload.map(({ user, count }) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Avatar user={user} size="sm" showStatus />
                  <span className="w-28 shrink-0 truncate text-small text-fg sm:w-40">{user.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-line">
                    <div
                      className="h-full rounded-pill bg-brand transition-[width] duration-300 ease-smooth"
                      style={{ width: `${(count / m.maxLoad) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-caption tabular-nums text-muted">{count}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Распределение */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 md:grid-cols-2">
            <Section title="По приоритету">
              <div className="flex flex-col gap-3">
                {PRIORITY_ORDER.map((p) => {
                  const meta = PRIORITY_META[p]
                  const count = m.byPriority[p] ?? 0
                  const max = Math.max(1, ...PRIORITY_ORDER.map((k) => m.byPriority[k] ?? 0))
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-small text-muted">{meta.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-line">
                        <div
                          className="h-full rounded-pill transition-[width] duration-300 ease-smooth"
                          style={{ width: `${(count / max) * 100}%`, background: meta.color }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-caption tabular-nums text-muted">{count}</span>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="По спискам">
              <div className="flex flex-col gap-3">
                {m.byList.map((b) => (
                  <div key={b.title} className="flex items-center gap-3">
                    <span className="flex w-24 shrink-0 items-center gap-2 text-small text-muted">
                      <span className="h-2 w-2 rounded-pill" style={{ background: b.accent }} />
                      <span className="truncate">{b.title}</span>
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-pill bg-line">
                      <div
                        className="h-full rounded-pill transition-[width] duration-300 ease-smooth"
                        style={{ width: `${(b.count / m.maxList) * 100}%`, background: b.accent }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-caption tabular-nums text-muted">{b.count}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  caption,
  accent,
  badge,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  caption?: string
  accent?: string
  badge?: string
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-hover text-muted">
          <Icon size={18} strokeWidth={2} />
        </span>
        {badge && (
          <span className="rounded-pill bg-hover px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 text-h1 font-bold leading-none" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="mt-1.5 text-small text-muted">{label}</div>
      {caption && <div className="mt-0.5 text-[11px] text-faint">{caption}</div>}
    </div>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}
