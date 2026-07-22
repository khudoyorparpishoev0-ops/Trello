import { useEffect, useMemo, useState } from 'react'
import { Menu, Sun, Moon, Cake, Building2 } from 'lucide-react'
import type { User } from '@/types'
import { fetchUsers, type AuthUser } from '@/lib/api'
import { useTheme } from '@/store/theme'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

function parseBday(b?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b ?? '')
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null
}
function daysUntil(b?: string): number | null {
  const p = parseBday(b)
  if (!p) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  let next = new Date(now.getFullYear(), p.mo, p.d)
  if (next.getTime() < now.getTime()) next = new Date(now.getFullYear() + 1, p.mo, p.d)
  return Math.round((next.getTime() - now.getTime()) / 86_400_000)
}
function fmtBday(b?: string): string {
  const p = parseBday(b)
  return p ? `${p.d} ${RU_MONTHS[p.mo]}` : '—'
}
function nextAge(b?: string): number | null {
  const p = parseBday(b)
  if (!p) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thisYear = new Date(now.getFullYear(), p.mo, p.d)
  const year = thisYear.getTime() < now.getTime() ? now.getFullYear() + 1 : now.getFullYear()
  return year - p.y
}
function countdown(days: number): { text: string; soon: boolean } {
  if (days === 0) return { text: 'Сегодня 🎂', soon: true }
  if (days === 1) return { text: 'Завтра', soon: true }
  if (days === 2) return { text: 'Послезавтра', soon: true }
  return { text: `через ${days} дн.`, soon: false }
}

function toUser(u: AuthUser): User {
  return { id: u.id ?? u.login ?? u.name, name: u.name, initials: u.initials, color: u.color }
}

export function Team({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggle } = useTheme()
  const [users, setUsers] = useState<AuthUser[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchUsers().then((u) => {
      if (!cancelled) setUsers(u)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const byBirthday = useMemo(() => {
    if (!users) return []
    return [...users]
      .map((u) => ({ u, days: daysUntil(u.birthday) }))
      .filter((x) => x.days !== null)
      .sort((a, b) => (a.days as number) - (b.days as number))
  }, [users])

  const next = byBirthday[0]

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <div className="min-w-0">
            <h1 className="truncate text-h3 font-semibold text-fg">Команда</h1>
            <p className="hidden text-caption text-faint sm:block">
              {users ? `${users.length} чел.` : '…'} · дни рождения
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-container">
          {users === null && <p className="text-small text-muted">Загрузка…</p>}

          {users !== null && users.length === 0 && (
            <div className="rounded-card border border-dashed border-line py-12 text-center text-muted">
              Пока никто не зарегистрировался.
              <div className="mt-1 text-caption text-faint">
                Здесь появится команда и ближайшие дни рождения.
              </div>
            </div>
          )}

          {users !== null && users.length > 0 && (
            <>
              {/* Ближайший день рождения */}
              {next && (
                <div className="mb-5 flex items-center gap-4 rounded-card border border-brand-border bg-brand-soft p-4 sm:mb-6 sm:p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-brand/20 text-brand">
                    <Cake size={22} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-caption font-semibold uppercase tracking-wide text-brand">
                      Ближайший день рождения
                    </div>
                    <div className="truncate text-body font-semibold text-fg">
                      {next.u.name} · {countdown(next.days as number).text}
                    </div>
                    <div className="text-caption text-muted">
                      {fmtBday(next.u.birthday)}
                      {nextAge(next.u.birthday) ? ` · исполняется ${nextAge(next.u.birthday)}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Дни рождения по порядку */}
              <Section title="Дни рождения">
                <div className="flex flex-col divide-y divide-line">
                  {byBirthday.map(({ u, days }) => {
                    const cd = countdown(days as number)
                    return (
                      <div key={u.id ?? u.login} className="flex items-center gap-3 py-2.5">
                        <Avatar user={toUser(u)} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-small font-medium text-fg">{u.name}</div>
                          <div className="truncate text-caption text-faint">
                            {u.department || '—'} · {fmtBday(u.birthday)}
                          </div>
                        </div>
                        <Pill tone={cd.soon ? 'brand' : 'muted'} icon={cd.soon ? Cake : undefined}>
                          {cd.text}
                        </Pill>
                      </div>
                    )
                  })}
                </div>
              </Section>

              {/* Полный состав */}
              <Section title={`Состав · ${users.length}`} className="mt-5 sm:mt-6">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {users.map((u) => (
                    <div
                      key={u.id ?? u.login}
                      className="flex items-center gap-3 rounded-input border border-line bg-bg px-3 py-2"
                    >
                      <Avatar user={toUser(u)} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-small font-medium text-fg">
                          {u.name}
                          {u.role === 'admin' && (
                            <span className="ml-2 rounded-badge bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                              админ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 truncate text-caption text-faint">
                          <Building2 size={12} strokeWidth={2} />
                          {u.department || '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}
