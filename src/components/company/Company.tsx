import { useEffect, useMemo, useState } from 'react'
import { Menu, Sun, Moon, Plus, X, Building2, Cake, Crown, KeyRound } from 'lucide-react'
import type { User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { useAuth } from '@/store/auth'
import { fetchUsers, resetPassword, type AuthUser } from '@/lib/api'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Badge'

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
function fmtBday(b?: string) {
  const p = parseBday(b)
  return p ? `${p.d} ${RU_MONTHS[p.mo]}` : '—'
}
function countdown(days: number) {
  if (days === 0) return 'Сегодня 🎂'
  if (days === 1) return 'Завтра'
  if (days === 2) return 'Послезавтра'
  return `через ${days} дн.`
}
function toUser(u: AuthUser): User {
  return { id: u.id ?? u.login ?? u.name, name: u.name, initials: u.initials, color: u.color }
}

interface CompanyProps {
  onMenuClick: () => void
  onNavigateBoard: () => void
}

export function Company({ onMenuClick, onNavigateBoard }: CompanyProps) {
  const { state, boards, departments, actions } = useBoard()
  const { authActive, user: authUser } = useAuth()
  const { theme, toggle } = useTheme()
  const isAdmin = authUser?.role === 'admin'
  const [users, setUsers] = useState<AuthUser[]>([])
  const [newDept, setNewDept] = useState('')
  const [newBoard, setNewBoard] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [resetFor, setResetFor] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchUsers().then((u) => !cancelled && setUsers(u))
    return () => {
      cancelled = true
    }
  }, [])

  const birthdays = useMemo(
    () =>
      users
        .map((u) => ({ u, days: daysUntil(u.birthday) }))
        .filter((x) => x.days !== null)
        .sort((a, b) => (a.days as number) - (b.days as number)),
    [users],
  )

  const openBoard = (id: string) => {
    actions.switchBoard(id)
    onNavigateBoard()
  }
  const createBoard = () => {
    const n = newBoard.trim()
    if (!n) return
    actions.addBoard(n)
    setNewBoard('')
    setCreatingBoard(false)
    onNavigateBoard()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <div className="min-w-0">
            <h1 className="truncate text-h3 font-semibold text-fg">Компания</h1>
            <p className="hidden text-caption text-faint sm:block">{state.workspace.name}</p>
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
        <div className="mx-auto flex max-w-container flex-col gap-5 sm:gap-6">
          {/* Проекты */}
          <Section title={`Проекты · ${boards.length}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => openBoard(b.id)}
                  className="flex flex-col justify-between gap-4 rounded-card border border-line bg-bg p-4 text-left transition-colors hover:border-line-strong"
                >
                  <span className="truncate text-small font-medium text-fg">{b.name}</span>
                  <AvatarStack users={b.memberIds.map((id) => state.users[id]).filter(Boolean)} size="sm" max={4} />
                </button>
              ))}

              {creatingBoard ? (
                <div className="rounded-card border border-line bg-surface p-3">
                  <input
                    autoFocus
                    value={newBoard}
                    onChange={(e) => setNewBoard(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createBoard()
                      if (e.key === 'Escape') setCreatingBoard(false)
                    }}
                    placeholder="Название проекта…"
                    className="w-full rounded-input border border-line bg-bg px-3 py-2 text-small text-fg outline-none focus:border-brand placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={createBoard}
                    className="mt-2 w-full rounded-btn bg-brand py-1.5 text-caption font-medium text-white hover:bg-[#15913f]"
                  >
                    Создать
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingBoard(true)}
                  className="flex min-h-[92px] items-center justify-center gap-2 rounded-card border border-dashed border-line-strong text-small text-muted transition-colors hover:border-muted hover:text-fg"
                >
                  <Plus size={18} strokeWidth={2} /> Новый проект
                </button>
              )}
            </div>
          </Section>

          {/* Отделы */}
          <Section title={`Отделы · ${departments.length}`}>
            <div className="flex flex-col divide-y divide-line">
              {departments.map((d) => (
                <div key={d} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-hover text-muted">
                    <Building2 size={16} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small text-fg">{d}</span>
                  <span className="shrink-0 text-caption text-faint">
                    {users.filter((u) => u.department === d).length} чел.
                  </span>
                  {authActive && (
                    <button
                      type="button"
                      onClick={() => actions.removeDepartment(d)}
                      aria-label={`Удалить отдел ${d}`}
                      className="shrink-0 rounded-[6px] p-1 text-faint opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newDept.trim()) {
                    actions.addDepartment(newDept)
                    setNewDept('')
                  }
                }}
                placeholder="Добавить отдел…"
                className="flex-1 rounded-input border border-line bg-bg px-3 py-2 text-small text-fg outline-none focus:border-brand placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => {
                  if (newDept.trim()) {
                    actions.addDepartment(newDept)
                    setNewDept('')
                  }
                }}
                className="rounded-btn bg-surface px-3 py-2 text-caption font-medium text-fg hover:bg-hover"
              >
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
          </Section>

          {/* Сотрудники */}
          <Section title={`Сотрудники · ${users.length}`}>
            {users.length === 0 ? (
              <Empty>Пока никто не зарегистрировался.</Empty>
            ) : (
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-small">
                  <thead>
                    <tr className="text-left text-caption uppercase tracking-wide text-faint">
                      <th className="px-2 py-2 font-semibold">Имя</th>
                      <th className="px-2 py-2 font-semibold">E-mail</th>
                      <th className="px-2 py-2 font-semibold">Должность</th>
                      <th className="px-2 py-2 font-semibold">Отдел</th>
                      {isAdmin && <th className="px-2 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id ?? u.login} className="border-t border-line">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar user={toUser(u)} size="sm" />
                            <span className="truncate text-fg">{u.name}</span>
                            {u.role === 'admin' && <Crown size={13} className="shrink-0 text-warning" />}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-muted">{u.email || '—'}</td>
                        <td className="px-2 py-2 text-muted">{u.position || '—'}</td>
                        <td className="px-2 py-2 text-muted">{u.department || '—'}</td>
                        {isAdmin && (
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setResetFor(u)}
                              title="Сбросить пароль"
                              aria-label={`Сбросить пароль ${u.name}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-btn text-muted hover:bg-hover hover:text-fg"
                            >
                              <KeyRound size={15} strokeWidth={2} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Дни рождения */}
          {birthdays.length > 0 && (
            <Section title="Дни рождения">
              <div className="flex flex-col divide-y divide-line">
                {birthdays.map(({ u, days }) => (
                  <div key={u.id ?? u.login} className="flex items-center gap-3 py-2.5">
                    <Avatar user={toUser(u)} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium text-fg">{u.name}</div>
                      <div className="truncate text-caption text-faint">{fmtBday(u.birthday)}</div>
                    </div>
                    <Pill tone={(days as number) <= 2 ? 'brand' : 'muted'} icon={(days as number) <= 2 ? Cake : undefined}>
                      {countdown(days as number)}
                    </Pill>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  )
}

function ResetPasswordModal({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const gen = () =>
    setPw(Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6))

  const submit = async () => {
    if (pw.length < 6) {
      setResult({ ok: false, text: 'Пароль минимум 6 символов' })
      return
    }
    setLoading(true)
    const r = await resetPassword(user.id ?? '', pw)
    setLoading(false)
    if (r.ok) {
      setResult({ ok: true, text: 'Пароль сброшен. Передайте его сотруднику — старый вход отключён.' })
    } else {
      setResult({ ok: false, text: r.error === 'forbidden' ? 'Сбрасывать может только админ' : 'Не удалось сбросить' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[380px] rounded-modal border border-line bg-elevated p-5 shadow-md animate-scale-in">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-fg">Сбросить пароль</h3>
          <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
        </div>
        <p className="mb-4 text-caption text-muted">Сотрудник: {user.name}</p>

        {result?.ok ? (
          <>
            <div className="rounded-input bg-success-soft p-3 text-small text-success">{result.text}</div>
            <div className="mt-3 rounded-input border border-line bg-bg px-3 py-2 font-mono text-small text-fg">
              {pw}
            </div>
            <Button className="mt-4 w-full" onClick={onClose}>
              Готово
            </Button>
          </>
        ) : (
          <>
            <label className="mb-1.5 block text-caption font-medium text-muted">Новый пароль</label>
            <div className="flex gap-2">
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="минимум 6 символов"
                className="min-w-0 flex-1 rounded-input border border-line bg-bg px-3 py-2 text-small text-fg outline-none focus:border-brand placeholder:text-faint"
              />
              <button
                type="button"
                onClick={gen}
                className="shrink-0 rounded-btn bg-surface px-3 text-caption font-medium text-muted hover:text-fg"
              >
                Сгенерировать
              </button>
            </div>
            {result && !result.ok && <p className="mt-2 text-caption text-error">{result.text}</p>}
            <div className="mt-4 flex gap-2">
              <Button onClick={submit} loading={loading} disabled={loading} className="flex-1">
                Сбросить
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Отмена
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-btn border border-dashed border-line py-8 text-center text-caption text-faint">
      {children}
    </div>
  )
}
