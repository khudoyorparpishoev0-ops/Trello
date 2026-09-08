import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ListChecks,
  Clock,
  CheckCircle2,
  Users,
  Gift,
  Zap,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import type { Card, User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useNow } from '@/store/now'
import { fetchUsers, type AuthUser } from '@/lib/api'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { PriorityDot } from '@/components/ui/Priority'
import { Pill } from '@/components/ui/Badge'
import { isListDone } from '@/lib/design'
import { cn, dueStatus, formatDate, taskCode, timeAgo } from '@/lib/utils'

interface DashboardProps {
  onMenuClick: () => void
  onOpenCard?: (id: string) => void
}

/** Норма активных задач на человека — база расчёта загрузки. */
const NORM = 4

/**
 * Дашборд.
 *
 * Все показатели считаются из данных доски: захардкоженных «демо-дельт» и
 * выдуманной ленты активности здесь больше нет. Там, где истории изменений в
 * модели нет (динамика неделя к неделе), показывается честное «истории пока
 * нет», а не придуманное число.
 */
export function Dashboard({ onMenuClick, onOpenCard }: DashboardProps) {
  const { state, departments } = useBoard()
  const now = useNow()
  const [people, setPeople] = useState<AuthUser[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchUsers().then((u) => !cancelled && setPeople(u))
    return () => {
      cancelled = true
    }
  }, [])

  const m = useMemo(() => {
    const { board, lists, cards, users } = state
    const doneByCard: Record<string, boolean> = {}
    for (const lid of board.listIds) {
      const list = lists[lid]
      if (!list) continue
      const done = isListDone(list)
      for (const cid of list.cardIds) doneByCard[cid] = done
    }

    const all = Object.values(cards)
    let total = 0
    let done = 0
    let overdue = 0
    const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    const load: Record<string, number> = {}
    const deadlines: Card[] = []

    for (const c of all) {
      total += 1
      if (doneByCard[c.id]) {
        done += 1
        continue
      }
      byPriority[c.priority] += 1
      for (const uid of c.assigneeIds) load[uid] = (load[uid] ?? 0) + 1
      if (dueStatus(c.dueDate, false, new Date(now)) === 'overdue') overdue += 1
      if (c.dueDate) deadlines.push(c)
    }
    const active = total - done

    const members = board.memberIds.map((id) => users[id]).filter(Boolean)
    const workload = members
      .map((u) => ({
        user: u,
        count: load[u.id] ?? 0,
        pct: Math.min(100, Math.round(((load[u.id] ?? 0) / NORM) * 100)),
      }))
      .sort((a, b) => b.count - a.count)
    const avgPct = members.length
      ? Math.round(workload.reduce((s, w) => s + w.pct, 0) / members.length)
      : 0

    deadlines.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

    // Лента активности из реальных данных: комментарии и создание карточек.
    const feed: { id: string; at: string; who?: User; text: string; cardId: string }[] = []
    for (const c of all) {
      feed.push({
        id: `new_${c.id}`,
        at: c.createdAt,
        text: `создана задача «${c.title}»`,
        cardId: c.id,
      })
      for (const cm of c.comments) {
        feed.push({
          id: cm.id,
          at: cm.createdAt,
          who: users[cm.authorId],
          text: `оставил(а) сообщение в «${c.title}»`,
          cardId: c.id,
        })
      }
    }
    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    return {
      total,
      done,
      active,
      overdue,
      byPriority,
      workload,
      avgPct,
      doneByCard,
      deadlines: deadlines.slice(0, 5),
      feed: feed.slice(0, 5),
      members,
    }
  }, [state, now])

  /**
   * Загрузка по отделам. Отдел берётся из профилей сотрудников, задачи — из
   * назначений. Отдел без людей или без задач честно помечается пустым, а не
   * получает выдуманный план.
   */
  const depts = useMemo(() => {
    const byDept: Record<string, { users: User[]; total: number; done: number }> = {}
    for (const name of departments) byDept[name] = { users: [], total: 0, done: 0 }

    for (const u of Object.values(state.users)) {
      const d = u.department
      if (d && byDept[d]) byDept[d].users.push(u)
    }
    for (const c of Object.values(state.cards)) {
      const seen = new Set<string>()
      for (const uid of c.assigneeIds) {
        const d = state.users[uid]?.department
        if (!d || !byDept[d] || seen.has(d)) continue
        seen.add(d)
        byDept[d].total += 1
        if (m.doneByCard[c.id]) byDept[d].done += 1
      }
    }
    return departments.map((name) => {
      const d = byDept[name]
      return {
        name,
        users: d.users,
        total: d.total,
        done: d.done,
        pct: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
      }
    })
  }, [departments, state.users, state.cards, m.doneByCard])

  // Отделы без людей и задач не занимают место кольцами — уходят строкой ниже.
  const activeDepts = depts.filter((d) => d.total > 0 || d.users.length > 0)
  const idleDepts = depts.filter((d) => d.total === 0 && d.users.length === 0)

  const birthdays = useMemo(() => nearestBirthdays(people, now), [people, now])

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Панель управления"
        title="Дашборд"
        subtitle="Обзор задач, команды и текущего статуса проектов"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-container flex-col gap-6">
          {/* KPI */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={ListChecks}
              label="Активные задачи"
              value={m.active}
              tone="brand"
              note={m.total > 0 ? `из ${m.total} всего на доске` : 'Задач пока нет'}
              meter={
                m.active > 0
                  ? [
                      { value: m.byPriority.critical, color: 'var(--err)' },
                      { value: m.byPriority.high, color: 'var(--warn)' },
                      { value: m.byPriority.medium, color: 'var(--info)' },
                      { value: m.byPriority.low, color: '#9AA39C' },
                    ]
                  : undefined
              }
              meterNote="по приоритетам"
            />
            <Kpi
              icon={Clock}
              label="Просроченные"
              value={m.overdue}
              tone={m.overdue > 0 ? 'err' : 'muted'}
              note={
                m.active > 0
                  ? `${Math.round((m.overdue / m.active) * 100)}% активных задач`
                  : 'Активных задач нет'
              }
              meter={
                m.active > 0
                  ? [
                      { value: m.overdue, color: 'var(--err)' },
                      { value: m.active - m.overdue, color: 'var(--track)' },
                    ]
                  : undefined
              }
              meterNote="просрочено / в срок"
            />
            <Kpi
              icon={CheckCircle2}
              label="Выполнено"
              value={m.done}
              tone="ok"
              note={m.total > 0 ? `${Math.round((m.done / m.total) * 100)}% всех задач` : 'Задач пока нет'}
              meter={
                m.total > 0
                  ? [
                      { value: m.done, color: 'var(--green)' },
                      { value: m.total - m.done, color: 'var(--track)' },
                    ]
                  : undefined
              }
              meterNote="закрыто / в работе"
            />
            <Kpi
              icon={Users}
              label="Загрузка команды"
              value={`${m.avgPct}%`}
              tone={m.avgPct >= 90 ? 'err' : m.avgPct >= 70 ? 'warn' : 'brand'}
              note={`Норма — ${NORM} задачи на человека`}
              meter={[
                { value: m.avgPct, color: m.avgPct >= 90 ? 'var(--err)' : m.avgPct >= 70 ? 'var(--warn)' : 'var(--green)' },
                { value: Math.max(0, 100 - m.avgPct), color: 'var(--track)' },
              ]}
              meterNote="от нормы"
            />
          </div>

          {/* Отделы + правая колонка */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_320px]">
            <Panel
              icon={Layers}
              title="Загрузка по отделам"
              sub="Доля закрытых задач и состав отделов"
            >
              {depts.length === 0 ? (
                <Empty text="Отделы не заведены" hint="Добавьте их в разделе «Компания»." />
              ) : activeDepts.length === 0 ? (
                <Empty
                  text="Задачи ещё не распределены по отделам"
                  hint="Назначьте исполнителей — отдел берётся из их профилей."
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-6">
                    {activeDepts.map((d) => (
                      <DeptRing key={d.name} {...d} />
                    ))}
                  </div>
                  {idleDepts.length > 0 && (
                    <p className="mt-5 border-t border-line pt-4 text-caption text-muted">
                      Без людей и задач: {idleDepts.map((d) => d.name).join(', ')}
                    </p>
                  )}
                </>
              )}
            </Panel>

            <div className="flex flex-col gap-6">
              {/* Карточка-цитата: единственный тёмно-зелёный блок на экране */}
              <section className="rounded-card bg-sidebar p-6">
                <p className="mono-label text-sidebar-muted">Принцип компании</p>
                <p className="mt-4 text-h3 leading-[28px] text-white">
                  Задача без срока и исполнителя — это не задача, а пожелание.
                </p>
                <span className="mt-5 block h-0.5 w-8 bg-sidebar-muted" aria-hidden />
                <p className="mt-4 text-caption text-sidebar-muted">Системы. Люди. Развитие.</p>
              </section>

              <Panel icon={Gift} title="Дни рождения" sub="Ближайшие даты команды">
                {birthdays.length === 0 ? (
                  <Empty text="Дат пока нет" hint="Они появятся, когда сотрудники заполнят профиль." />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {birthdays.slice(0, 3).map(({ user, days, label }) => (
                      <li key={user.id} className="flex items-center gap-3">
                        <Avatar user={user} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body text-fg">{user.name}</span>
                          <span className="block truncate text-caption text-muted">{label}</span>
                        </span>
                        {days === 0 && <Pill tone="ok" rule>Сегодня</Pill>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          {/* Дедлайны + активность */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_320px]">
            <Panel icon={Clock} title="Ближайшие дедлайны" sub="Пять ближайших сроков по доске">
              {m.deadlines.length === 0 ? (
                <Empty text="Дедлайнов нет" hint="Задайте срок задаче, чтобы она попала сюда." />
              ) : (
                <div className="-mx-6 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                      <tr className="mono-label border-b border-line text-left text-faint">
                        <th className="px-6 pb-2 font-semibold">Код</th>
                        <th className="px-3 pb-2 font-semibold">Задача</th>
                        <th className="px-3 pb-2 font-semibold">Срок</th>
                        <th className="px-6 pb-2 text-right font-semibold">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.deadlines.map((c) => {
                        const st = dueStatus(c.dueDate, m.doneByCard[c.id] ?? false, new Date(now))
                        return (
                          <tr
                            key={c.id}
                            onClick={() => onOpenCard?.(c.id)}
                            className="h-14 cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-hover"
                          >
                            <td className="mono-data px-6 text-muted">{taskCode(c)}</td>
                            <td className="max-w-0 px-3">
                              <span className="flex items-center gap-2">
                                <PriorityDot priority={c.priority} />
                                <span className="truncate text-body text-fg">{c.title}</span>
                              </span>
                            </td>
                            <td className="mono-data px-3 text-muted">
                              {formatDate(c.dueDate!).toUpperCase()}
                            </td>
                            <td className="px-6 text-right">
                              <Pill
                                tone={st === 'overdue' ? 'err' : st === 'soon' ? 'warn' : 'muted'}
                                rule={st === 'overdue' || st === 'soon'}
                              >
                                {st === 'overdue' ? 'Просрочено' : st === 'soon' ? 'Скоро' : 'В срок'}
                              </Pill>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel icon={Zap} title="Активность" sub="Последние события доски">
              {m.feed.length === 0 ? (
                <Empty text="Событий пока нет" hint="Создайте задачу или напишите в чат задачи." />
              ) : (
                <ul className="flex flex-col gap-4 border-l border-line pl-4">
                  {m.feed.map((f) => (
                    <li key={f.id} className="relative">
                      <span
                        className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 border border-surface bg-brand"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => onOpenCard?.(f.cardId)}
                        className="block w-full text-left"
                      >
                        <span className="mono-data block text-faint">{timeAgo(f.at, now)}</span>
                        <span className="mt-1 block text-caption text-fg">
                          {f.who ? <span className="font-semibold">{f.who.name} </span> : null}
                          {f.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <p className="text-body text-muted">Системы. Люди. Развитие.</p>
            <p className="mono-label text-muted">IT-HONA | Душанбе, Таджикистан | {new Date(now).getFullYear()}</p>
          </footer>
        </div>
      </div>
    </div>
  )
}

/* ——— Ближайшие дни рождения ——— */

function nearestBirthdays(
  people: AuthUser[],
  now: number,
): { user: User; days: number; label: string }[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]
  return people
    .map((p) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthday ?? '')
      if (!match) return null
      const mo = +match[2] - 1
      const day = +match[3]
      let next = new Date(today.getFullYear(), mo, day)
      if (next.getTime() < today.getTime()) next = new Date(today.getFullYear() + 1, mo, day)
      const days = Math.round((next.getTime() - today.getTime()) / 86_400_000)
      const when = days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `через ${days} дн.`
      return {
        user: {
          id: p.id ?? p.login ?? p.name,
          name: p.name,
          initials: p.initials,
          color: p.color,
          avatar: p.avatar || undefined,
          department: p.department || undefined,
        } as User,
        days,
        label: `${day} ${months[mo]} · ${when}`,
      }
    })
    .filter((x): x is { user: User; days: number; label: string } => x !== null)
    .sort((a, b) => a.days - b.days)
}

/* ——— Блоки ——— */

const TONE_INK: Record<string, string> = {
  brand: 'text-brand-ink',
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  err: 'text-err-ink',
  muted: 'text-fg',
}
const TONE_BG: Record<string, string> = {
  brand: 'bg-brand-bg text-brand-ink',
  ok: 'bg-ok-bg text-ok-ink',
  warn: 'bg-warn-bg text-warn-ink',
  err: 'bg-err-bg text-err-ink',
  muted: 'bg-mist text-muted',
}

/**
 * Плитка показателя. Вместо декоративного спарклайна — полоса реального
 * состава: истории по неделям в модели нет, а рисовать выдуманную кривую,
 * которую примут за факт, нельзя.
 */
function Kpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
  meter,
  meterNote,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  note: string
  tone: 'brand' | 'ok' | 'warn' | 'err' | 'muted'
  meter?: { value: number; color: string }[]
  meterNote?: string
}) {
  const sum = meter?.reduce((s, p) => s + p.value, 0) ?? 0
  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-chip', TONE_BG[tone])}>
          <Icon size={20} strokeWidth={1.6} />
        </span>
        <span className="text-body font-semibold">{label}</span>
      </div>
      <p data-kpi className={cn('mono-data mt-4 text-[44px] leading-[48px] tracking-normal', TONE_INK[tone])}>
        {value}
      </p>
      <p className="mt-1 text-small text-muted">{note}</p>
      {meter && sum > 0 && (
        <>
          <span className="mt-4 flex h-1.5 w-full overflow-hidden bg-track" aria-hidden>
            {meter.map((p, i) => (
              <span key={i} style={{ width: `${(p.value / sum) * 100}%`, background: p.color }} />
            ))}
          </span>
          {meterNote && <p className="mono-label mt-2 text-faint">{meterNote}</p>}
        </>
      )}
    </section>
  )
}

function Panel({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: LucideIcon
  title: string
  sub?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-mist text-muted">
          <Icon size={20} strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <h2 className="text-h3">{title}</h2>
          {sub && <p className="mt-0.5 text-caption text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="rounded-chip border border-dashed border-line px-4 py-8 text-center">
      <p className="text-body text-muted">{text}</p>
      {hint && <p className="mt-1 text-caption text-faint">{hint}</p>}
    </div>
  )
}

/**
 * Кольцо загрузки отдела. Это шкала одного значения (доля закрытых задач), а
 * не круговая диаграмма долей: разбивать целое на секторы брендбук запрещает.
 */
function DeptRing({
  name,
  users,
  total,
  done,
  pct,
}: {
  name: string
  users: User[]
  total: number
  done: number
  pct: number
}) {
  const r = 48
  const c = 2 * Math.PI * r
  return (
    <div className="flex w-[132px] flex-col items-center gap-2">
      <span className="mono-label w-full truncate text-center text-muted" title={name}>
        {name}
      </span>
      <span className="relative flex h-28 w-28 items-center justify-center">
        <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
          <circle cx="56" cy="56" r={r} fill="none" stroke="var(--track)" strokeWidth="10" />
          {total > 0 && (
            <circle
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke="var(--green)"
              strokeWidth="10"
              strokeDasharray={`${(pct / 100) * c} ${c}`}
              transform="rotate(-90 56 56)"
            />
          )}
        </svg>
        <span className="mono-data absolute text-[19px] text-fg">{total > 0 ? `${pct}%` : '—'}</span>
      </span>
      <span className="text-caption text-muted">
        {total > 0 ? `${done} / ${total} задач` : 'Нет задач'}
      </span>
      {users.length > 0 ? (
        <AvatarStack users={users} size="sm" max={3} />
      ) : (
        <span className="text-caption text-faint">Нет людей</span>
      )}
    </div>
  )
}
