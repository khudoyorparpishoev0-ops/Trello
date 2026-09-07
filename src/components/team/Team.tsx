import { useMemo, useState } from 'react'
import { Users, ListChecks, Clock, Gauge, Search, type LucideIcon } from 'lucide-react'
import type { User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useNow } from '@/store/now'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Badge'
import { isListDone } from '@/lib/design'
import { cn, dueStatus } from '@/lib/utils'

interface TeamProps {
  onMenuClick: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  member: 'Участник',
  observer: 'Наблюдатель',
}

/** Норма активных задач на человека — база расчёта загрузки. */
const NORM = 4

const COLS = 'grid-cols-[minmax(200px,2fr)_1.2fr_1fr_88px_88px_minmax(160px,1.4fr)]'

interface Row {
  u: User
  active: number
  overdue: number
  load: number
}

export function Team({ onMenuClick }: TeamProps) {
  const { state, departments } = useBoard()
  const now = useNow()
  const [tab, setTab] = useState<'people' | 'departments'>('people')
  const [query, setQuery] = useState('')

  const rows = useMemo<Row[]>(() => {
    // Карта cardId → список (для определения статуса «Готово»).
    const listOf: Record<string, string> = {}
    for (const l of Object.values(state.lists)) for (const cid of l.cardIds) listOf[cid] = l.id

    return Object.values(state.users)
      .map((u) => {
        let active = 0
        let overdue = 0
        for (const c of Object.values(state.cards)) {
          if (!c.assigneeIds.includes(u.id)) continue
          const list = state.lists[listOf[c.id]]
          const done = list ? isListDone(list) : false
          if (done) continue
          active++
          if (dueStatus(c.dueDate, done, new Date(now)) === 'overdue') overdue++
        }
        return { u, active, overdue, load: Math.min(100, Math.round((active / NORM) * 100)) }
      })
      .sort((a, b) => b.active - a.active)
  }, [state.users, state.cards, state.lists, now])

  const q = query.trim().toLowerCase()
  const visible = q
    ? rows.filter((r) => r.u.name.toLowerCase().includes(q) || (r.u.department ?? '').toLowerCase().includes(q))
    : rows

  const totals = useMemo(() => {
    const people = rows.length
    const active = rows.reduce((s, r) => s + r.active, 0)
    const withOverdue = rows.filter((r) => r.overdue > 0).length
    const avg = people ? Math.round(rows.reduce((s, r) => s + r.load, 0) / people) : 0
    return { people, active, withOverdue, avg }
  }, [rows])

  const deptRows = useMemo(
    () =>
      departments.map((name) => {
        const members = rows.filter((r) => r.u.department === name)
        const active = members.reduce((s, r) => s + r.active, 0)
        const overdue = members.reduce((s, r) => s + r.overdue, 0)
        const load = members.length
          ? Math.round(members.reduce((s, r) => s + r.load, 0) / members.length)
          : 0
        return { name, members, active, overdue, load }
      }),
    [departments, rows],
  )

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Люди"
        title="Команда"
        subtitle="Роли, отделы и загрузка относительно нормы"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-container flex-col gap-6">
          <div className="grid grid-cols-2 gap-6 xl:grid-cols-4">
            <Stat icon={Users} label="Всего сотрудников" value={totals.people} tone="muted" />
            <Stat icon={ListChecks} label="Активных задач" value={totals.active} tone="brand" />
            <Stat
              icon={Clock}
              label="С просрочками"
              value={totals.withOverdue}
              tone={totals.withOverdue > 0 ? 'err' : 'muted'}
            />
            <Stat
              icon={Gauge}
              label="Средняя загрузка"
              value={`${totals.avg}%`}
              tone={totals.avg >= 90 ? 'err' : totals.avg >= 70 ? 'warn' : 'ok'}
            />
          </div>

          <section className="rounded-card border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 pt-4">
              <div className="flex gap-6">
                {(
                  [
                    ['people', 'Сотрудники'],
                    ['departments', 'Отделы'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cn(
                      'border-b-2 pb-3 text-body transition-colors',
                      tab === k
                        ? 'border-b-brand font-semibold text-fg'
                        : 'border-b-transparent text-muted hover:text-fg',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="mb-3 ml-auto flex h-11 w-full items-center gap-2 rounded-chip border border-line bg-mist px-3 text-muted sm:w-[260px]">
                <Search size={18} strokeWidth={1.6} className="shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Имя или отдел"
                  className="min-w-0 flex-1 bg-transparent text-body text-fg outline-none"
                />
              </label>
            </div>

            {tab === 'people' ? (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[880px]">
                    <div className={cn('mono-label grid gap-4 bg-mist px-6 py-3 text-faint', COLS)}>
                      <span>Сотрудник</span>
                      <span>Роль</span>
                      <span>Отдел</span>
                      <span className="text-right">Активных</span>
                      <span className="text-right">Просроч.</span>
                      <span>Загрузка</span>
                    </div>

                    {visible.length === 0 && (
                      <p className="px-6 py-12 text-center text-body text-muted">
                        {q ? 'Никого не найдено' : 'Сотрудников пока нет'}
                      </p>
                    )}

                    {visible.map(({ u, active, overdue, load }) => (
                      <div
                        key={u.id}
                        className={cn(
                          'grid min-h-[72px] items-center gap-4 border-t border-line px-6 py-3',
                          COLS,
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar user={u} size="xl" />
                          <span className="min-w-0">
                            <span className="block truncate text-body font-semibold text-fg">{u.name}</span>
                            <span className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0"
                                style={{ background: u.online ? 'var(--green)' : 'var(--line-strong)' }}
                                aria-hidden
                              />
                              <span className="truncate text-caption text-muted">
                                {u.online ? 'Онлайн' : 'Офлайн'}
                              </span>
                            </span>
                          </span>
                        </span>

                        <span>
                          <Pill tone={u.role === 'admin' ? 'brand' : 'muted'}>
                            {ROLE_LABEL[u.role ?? 'member'] ?? 'Участник'}
                          </Pill>
                        </span>

                        <span className="truncate text-caption text-muted">{u.department ?? '—'}</span>
                        <span className="mono-data text-right text-fg">{active}</span>
                        <span className={cn('mono-data text-right', overdue > 0 ? 'text-err-ink' : 'text-muted')}>
                          {overdue}
                        </span>

                        <span className="flex items-center gap-3">
                          <span className="h-1.5 flex-1 overflow-hidden bg-track">
                            <span
                              className="block h-full transition-[width] duration-300"
                              style={{
                                width: `${load}%`,
                                background:
                                  load >= 90 ? 'var(--err)' : load >= 70 ? 'var(--warn)' : 'var(--green)',
                              }}
                            />
                          </span>
                          <span
                            className={cn(
                              'mono-data w-9 text-right',
                              load >= 90 ? 'text-err-ink' : load >= 70 ? 'text-warn-ink' : 'text-brand-ink',
                            )}
                          >
                            {load}%
                          </span>
                          <Pill tone={load >= 90 ? 'err' : 'ok'} rule>
                            {load >= 90 ? 'Перегружен' : 'В норме'}
                          </Pill>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-line px-6 py-3">
                  <span className="mono-label text-faint">
                    Показано {visible.length} из {rows.length}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col">
                {deptRows.length === 0 && (
                  <p className="px-6 py-12 text-center text-body text-muted">
                    Отделы не заведены — добавьте их в разделе «Компания».
                  </p>
                )}
                {deptRows.map((d) => (
                  <div
                    key={d.name}
                    className="flex min-h-[72px] flex-wrap items-center gap-4 border-t border-line px-6 py-3 first:border-t-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-fg">{d.name}</span>
                      <span className="block truncate text-caption text-muted">
                        {d.members.length === 0
                          ? 'Нет сотрудников'
                          : `${d.members.length} чел. · ${d.active} активных`}
                      </span>
                    </span>
                    {d.overdue > 0 && (
                      <Pill tone="err" rule>
                        {d.overdue} просроч.
                      </Pill>
                    )}
                    <span className="flex w-40 items-center gap-3">
                      <span className="h-1.5 flex-1 overflow-hidden bg-track">
                        <span
                          className="block h-full"
                          style={{
                            width: `${d.load}%`,
                            background:
                              d.load >= 90 ? 'var(--err)' : d.load >= 70 ? 'var(--warn)' : 'var(--green)',
                          }}
                        />
                      </span>
                      <span className="mono-data w-9 text-right text-muted">{d.load}%</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const TONE_BG: Record<string, string> = {
  brand: 'bg-brand-bg text-brand-ink',
  ok: 'bg-ok-bg text-ok-ink',
  warn: 'bg-warn-bg text-warn-ink',
  err: 'bg-err-bg text-err-ink',
  muted: 'bg-mist text-muted',
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  tone: 'brand' | 'ok' | 'warn' | 'err' | 'muted'
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-chip', TONE_BG[tone])}>
        <Icon size={18} strokeWidth={1.6} />
      </span>
      <p className="mono-data mt-4 text-[36px] leading-[40px] text-fg">{value}</p>
      <p className="mt-1 text-caption text-muted">{label}</p>
    </section>
  )
}
