import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  X,
  Building2,
  Gift,
  Crown,
  KeyRound,
  Send,
  Check,
  Copy,
  MoreVertical,
  Pencil,
  Users,
  Archive,
  ArchiveRestore,
  Link2,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@/types'
import { useBoard, type BoardSummary } from '@/store/boardStore'
import { useAuth } from '@/store/auth'
import {
  fetchUsers,
  resetPassword,
  telegramStatus,
  telegramLink,
  telegramUnlink,
  type AuthUser,
  type TelegramStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
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
  return {
    id: u.id ?? u.login ?? u.name,
    name: u.name,
    initials: u.initials,
    color: u.color,
    avatar: u.avatar || undefined,
    department: u.department || undefined,
  }
}

interface CompanyProps {
  onMenuClick: () => void
  onNavigateBoard: () => void
}

export function Company({ onMenuClick, onNavigateBoard }: CompanyProps) {
  const { state, boards, archivedBoards, departments, actions } = useBoard()
  const { authActive, user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'
  const [users, setUsers] = useState<AuthUser[]>([])
  const [newDept, setNewDept] = useState('')
  const [newBoard, setNewBoard] = useState('')
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [resetFor, setResetFor] = useState<AuthUser | null>(null)
  const [renameFor, setRenameFor] = useState<BoardSummary | null>(null)
  const [membersFor, setMembersFor] = useState<BoardSummary | null>(null)
  const [deleteFor, setDeleteFor] = useState<BoardSummary | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchUsers().then((u) => {
      if (cancelled) return
      setUsers(u)
      // Обновить фото/отделы этих сотрудников там, где они уже участники.
      actions.syncUserProfiles(u.map(toUser))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const memberUsersOf = (b: BoardSummary): User[] => b.memberIds.map((id) => state.users[id]).filter(Boolean)
  const copyLink = async (id: string) => {
    const link = `${window.location.origin}${window.location.pathname}?board=${id}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* буфер обмена недоступен — не критично */
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Организация"
        title="Компания"
        subtitle={`${state.workspace.name} · проекты, отделы, сотрудники и уведомления`}
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-container flex-col gap-6">
          {/* Проекты */}
          <Section title={`Проекты · ${boards.length}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((b) => (
                <ProjectCard
                  key={b.id}
                  board={b}
                  memberUsers={memberUsersOf(b)}
                  copied={copiedId === b.id}
                  canDelete={boards.length > 1}
                  onOpen={() => openBoard(b.id)}
                  onRename={() => setRenameFor(b)}
                  onMembers={() => setMembersFor(b)}
                  onDuplicate={() => actions.duplicateBoard(b.id)}
                  onArchive={() => actions.archiveBoard(b.id)}
                  onCopyLink={() => copyLink(b.id)}
                  onDelete={() => setDeleteFor(b)}
                />
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
                    className="h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={createBoard}
                    className="mt-2 h-11 w-full rounded-btn bg-brand-fill text-body font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Создать
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingBoard(true)}
                  className="flex min-h-[124px] items-center justify-center gap-2 rounded-card border border-dashed border-line-strong text-body text-muted transition-colors hover:border-brand hover:text-brand-ink"
                >
                  <Plus size={18} strokeWidth={1.6} /> Новый проект
                </button>
              )}
            </div>
          </Section>

          {/* Архив проектов */}
          {archivedBoards.length > 0 && (
            <Section title={`Архив · ${archivedBoards.length}`}>
              <div className="flex flex-col divide-y divide-line">
                {archivedBoards.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-mist text-faint">
                      <Archive size={18} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-muted">{b.name}</span>
                    <button
                      type="button"
                      onClick={() => actions.unarchiveBoard(b.id)}
                      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-btn border border-line px-3 text-small font-semibold text-fg transition-colors hover:bg-hover"
                    >
                      <ArchiveRestore size={16} strokeWidth={1.6} /> Вернуть
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Отделы */}
          <Section title={`Отделы · ${departments.length}`}>
            <div className="flex flex-col divide-y divide-line">
              {departments.map((d) => (
                <div key={d} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-mist text-muted">
                    <Building2 size={18} strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body text-fg">{d}</span>
                  <span className="mono-data shrink-0 text-faint">
                    {users.filter((u) => u.department === d).length} ЧЕЛ.
                  </span>
                  {authActive && (
                    <button
                      type="button"
                      onClick={() => actions.removeDepartment(d)}
                      aria-label={`Удалить отдел ${d}`}
                      className="shrink-0 rounded-chip p-1 text-faint transition-colors hover:text-err-ink"
                    >
                      <X size={16} strokeWidth={1.6} />
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
                className="h-11 flex-1 rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => {
                  if (newDept.trim()) {
                    actions.addDepartment(newDept)
                    setNewDept('')
                  }
                }}
                aria-label="Добавить отдел"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-line-strong text-fg transition-colors hover:bg-hover"
              >
                <Plus size={18} strokeWidth={1.6} />
              </button>
            </div>
          </Section>

          {/* Сотрудники */}
          <Section title={`Сотрудники · ${users.length}`}>
            {users.length === 0 ? (
              <Empty>Пока никто не зарегистрировался.</Empty>
            ) : (
              <div className="-mx-6 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="mono-label border-b border-line text-left text-faint">
                      <th className="px-6 pb-3 font-semibold">Имя</th>
                      <th className="px-3 pb-3 font-semibold">E-mail</th>
                      <th className="px-3 pb-3 font-semibold">Должность</th>
                      <th className="px-3 pb-3 font-semibold">Отдел</th>
                      {isAdmin && <th className="px-6 pb-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id ?? u.login} className="h-14 border-b border-line last:border-0">
                        <td className="px-6">
                          <span className="flex items-center gap-3">
                            <Avatar user={toUser(u)} size="md" />
                            <span className="truncate text-body text-fg">{u.name}</span>
                            {u.role === 'admin' && (
                              <Crown size={14} strokeWidth={1.6} className="shrink-0 text-warn-ink" />
                            )}
                          </span>
                        </td>
                        <td className="px-3 text-caption text-muted">{u.email || '—'}</td>
                        <td className="px-3 text-caption text-muted">{u.position || '—'}</td>
                        <td className="px-3 text-caption text-muted">{u.department || '—'}</td>
                        {isAdmin && (
                          <td className="px-6 text-right">
                            <button
                              type="button"
                              onClick={() => setResetFor(u)}
                              title="Сбросить пароль"
                              aria-label={`Сбросить пароль ${u.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-btn text-muted transition-colors hover:bg-hover hover:text-fg"
                            >
                              <KeyRound size={16} strokeWidth={1.6} />
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
                    <Avatar user={toUser(u)} size="xl" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body text-fg">{u.name}</div>
                      <div className="truncate text-caption text-muted">{fmtBday(u.birthday)}</div>
                    </div>
                    <Pill
                      tone={(days as number) <= 2 ? 'ok' : 'muted'}
                      rule={(days as number) <= 2}
                      icon={(days as number) <= 2 ? Gift : undefined}
                    >
                      {countdown(days as number)}
                    </Pill>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Telegram-уведомления */}
          {authActive && <TelegramCard />}
        </div>
      </div>

      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
      {renameFor && (
        <RenameBoardModal
          board={renameFor}
          onClose={() => setRenameFor(null)}
          onSave={(name) => {
            actions.renameBoard(renameFor.id, name)
            setRenameFor(null)
          }}
        />
      )}
      {membersFor && (
        <BoardMembersModal
          board={membersFor}
          employees={users}
          current={memberUsersOf(membersFor)}
          onClose={() => setMembersFor(null)}
          onSave={(members) => {
            actions.setBoardMembers(membersFor.id, members)
            setMembersFor(null)
          }}
        />
      )}
      {deleteFor && (
        <DeleteBoardModal
          board={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={() => {
            actions.deleteBoard(deleteFor.id)
            setDeleteFor(null)
          }}
        />
      )}
    </div>
  )
}

function ProjectCard({
  board,
  memberUsers,
  copied,
  canDelete,
  onOpen,
  onRename,
  onMembers,
  onDuplicate,
  onArchive,
  onCopyLink,
  onDelete,
}: {
  board: BoardSummary
  memberUsers: User[]
  copied: boolean
  canDelete: boolean
  onOpen: () => void
  onRename: () => void
  onMembers: () => void
  onDuplicate: () => void
  onArchive: () => void
  onCopyLink: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="relative flex min-h-[124px] flex-col justify-between gap-4 rounded-card border border-line bg-mist p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0"
              style={{
                background:
                  board.overdue > 0 ? 'var(--warn)' : board.active > 0 ? 'var(--green)' : 'var(--line-strong)',
              }}
              aria-hidden
            />
            <span className="min-w-0 truncate text-body font-semibold text-fg">{board.name}</span>
          </span>
          <span className="mt-1 block truncate text-caption text-muted">
            {board.total === 0
              ? 'Пока нет задач'
              : `Готово ${board.total - board.active} из ${board.total}${board.overdue > 0 ? ` · ${board.overdue} просроч.` : ''}`}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню проекта"
          aria-haspopup="menu"
          className="-mr-1.5 -mt-1.5 shrink-0 rounded-btn p-1.5 text-faint transition-colors hover:bg-hover hover:text-fg"
        >
          <MoreVertical size={18} strokeWidth={1.6} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="flex text-left">
        <AvatarStack users={memberUsers} size="sm" max={4} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            role="menu"
            className="absolute right-3 top-12 z-50 w-60 overflow-hidden rounded-card border border-line bg-elevated py-1 shadow-md animate-scale-in"
          >
            <MenuItem icon={Pencil} label="Переименовать" onClick={() => { close(); onRename() }} />
            <MenuItem icon={Users} label="Участники и роли" onClick={() => { close(); onMembers() }} />
            <MenuItem icon={Copy} label="Дублировать" onClick={() => { close(); onDuplicate() }} />
            <MenuItem icon={Archive} label="Поместить в архив" onClick={() => { close(); onArchive() }} />
            <MenuItem
              icon={copied ? Check : Link2}
              label={copied ? 'Скопировано ✓' : 'Скопировать ссылку'}
              onClick={onCopyLink}
            />
            {canDelete && (
              <>
                <div className="my-1 border-t border-line" />
                <MenuItem icon={Trash2} label="Удалить" danger onClick={() => { close(); onDelete() }} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-small transition-colors',
        danger ? 'text-err-ink hover:bg-err-bg' : 'text-fg hover:bg-hover',
      )}
    >
      <Icon size={16} strokeWidth={1.6} className="shrink-0" />
      {label}
    </button>
  )
}

function RenameBoardModal({
  board,
  onClose,
  onSave,
}: {
  board: BoardSummary
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(board.name)
  const save = () => {
    if (name.trim()) onSave(name.trim())
  }
  return (
    <ModalShell title="Переименовать проект" onClose={onClose}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onClose()
        }}
        className="h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
      />
      <div className="mt-5 flex gap-2">
        <Button onClick={save} disabled={!name.trim()} className="flex-1">
          Сохранить
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </ModalShell>
  )
}

function DeleteBoardModal({
  board,
  onClose,
  onConfirm,
}: {
  board: BoardSummary
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ModalShell title="Удалить проект?" onClose={onClose}>
      <p className="text-body text-muted">
        Проект <span className="font-semibold text-fg">«{board.name}»</span> и все его задачи будут удалены
        безвозвратно. Если хотите сохранить — используйте «Поместить в архив».
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="danger" onClick={onConfirm} className="flex-1">
          Удалить
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </ModalShell>
  )
}

function BoardMembersModal({
  board,
  employees,
  current,
  onClose,
  onSave,
}: {
  board: BoardSummary
  employees: AuthUser[]
  current: User[]
  onClose: () => void
  onSave: (members: User[]) => void
}) {
  // Кандидаты: зарегистрированные сотрудники + те, кто уже в проекте (демо-участники).
  const candidates = useMemo<User[]>(() => {
    const byId = new Map<string, User>()
    for (const u of current) byId.set(u.id, u)
    for (const e of employees) {
      const u = toUser(e)
      byId.set(u.id, u)
    }
    return [...byId.values()]
  }, [employees, current])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(current.map((u) => u.id)))
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ModalShell title="Участники проекта" onClose={onClose}>
      <p className="-mt-1 mb-3 text-caption text-muted">«{board.name}»</p>
      {candidates.length === 0 ? (
        <div className="rounded-chip border border-dashed border-line px-4 py-8 text-center text-body text-muted">
          Пока некого добавить — сотрудники появятся после регистрации.
        </div>
      ) : (
        <div className="-mx-1 max-h-[46vh] overflow-y-auto">
          {candidates.map((u) => {
            const on = selected.has(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-chip px-2 py-2 text-left hover:bg-hover"
              >
                <Avatar user={u} size="md" />
                <span className="min-w-0 flex-1 truncate text-body text-fg">{u.name}</span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-chip border',
                    on ? 'border-transparent bg-brand-fill text-white' : 'border-line-strong text-transparent',
                  )}
                >
                  <Check size={13} strokeWidth={2.4} />
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => onSave(candidates.filter((u) => selected.has(u.id)))}
          className="flex-1"
        >
          Сохранить ({selected.size})
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-[400px] rounded-modal border border-line bg-elevated p-6 shadow-md animate-scale-in">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-h3">{title}</h3>
          <IconButton icon={X} label="Закрыть" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}

function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<{ code: string; deepLink: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)

  const refresh = async () => {
    const s = await telegramStatus()
    setStatus(s)
    setLoading(false)
  }
  useEffect(() => {
    let cancelled = false
    void telegramStatus().then((s) => {
      if (cancelled) return
      setStatus(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const connect = async () => {
    setWorking(true)
    const r = await telegramLink()
    setWorking(false)
    if (r) setLink({ code: r.code, deepLink: r.deepLink })
  }
  const disconnect = async () => {
    setWorking(true)
    await telegramUnlink()
    setLink(null)
    await refresh()
    setWorking(false)
  }
  const copyLink = async () => {
    if (!link?.deepLink) return
    try {
      await navigator.clipboard.writeText(link.deepLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер обмена недоступен — ссылка всё равно видна на экране */
    }
  }

  if (loading) return null

  // Бот не настроен на сервере.
  if (status && !status.enabled) {
    return (
      <Section title="Telegram-уведомления">
        <p className="text-small text-muted">
          Бот не настроен. Администратору нужно создать бота в{' '}
          <span className="font-medium text-fg">@BotFather</span> и указать его токен в переменной{' '}
          <code className="rounded-chip bg-mist px-1.5 py-0.5 font-mono text-caption">TELEGRAM_BOT_TOKEN</code> на сервере.
        </p>
      </Section>
    )
  }

  return (
    <Section title="Telegram-уведомления">
      {status?.linked ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-ok-bg text-ok-ink">
            <Check size={18} strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-body font-semibold text-fg">Telegram подключён</div>
            <div className="text-caption text-muted">Присылаю напоминания о днях рождения и дедлайнах.</div>
          </div>
          <Button variant="secondary" onClick={disconnect} loading={working} disabled={working}>
            Отключить
          </Button>
        </div>
      ) : link ? (
        <div className="flex flex-col gap-3">
          <p className="text-small text-muted">
            Откройте ссылку в Telegram и нажмите <span className="font-medium text-fg">Start</span> — бот привяжется к
            вашему аккаунту.
          </p>
          <div className="flex items-center gap-2">
            <a
              href={link.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-btn bg-brand-fill px-4 text-body font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Send size={18} strokeWidth={1.6} /> Открыть в Telegram
            </a>
            <button
              type="button"
              onClick={copyLink}
              title="Скопировать ссылку"
              aria-label="Скопировать ссылку"
              className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-line text-muted transition-colors hover:bg-hover hover:text-fg"
            >
              {copied ? <Check size={18} strokeWidth={1.6} className="text-ok-ink" /> : <Copy size={18} strokeWidth={1.6} />}
            </button>
          </div>
          <div className="rounded-chip border border-line bg-mist px-3 py-2 font-mono text-caption text-muted break-all">
            {link.deepLink}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-mist text-muted">
            <Send size={18} strokeWidth={1.6} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-body font-semibold text-fg">Уведомления в Telegram</div>
            <div className="text-caption text-muted">
              Напоминания о днях рождения за 2 дня и о ближайших дедлайнах.
            </div>
          </div>
          <Button onClick={connect} loading={working} disabled={working}>
            Подключить
          </Button>
        </div>
      )}
    </Section>
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
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-[380px] rounded-modal border border-line bg-elevated p-6 shadow-md animate-scale-in">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-h3">Сбросить пароль</h3>
          <IconButton icon={X} label="Закрыть" onClick={onClose} />
        </div>
        <p className="mb-5 text-caption text-muted">Сотрудник: {user.name}</p>

        {result?.ok ? (
          <>
            <div className="border-l-2 border-l-brand bg-ok-bg p-3 text-caption text-ok-ink">{result.text}</div>
            <div className="mt-3 rounded-chip border border-line bg-mist px-3 py-2 font-mono text-body text-fg">
              {pw}
            </div>
            <Button className="mt-5 w-full" onClick={onClose}>
              Готово
            </Button>
          </>
        ) : (
          <>
            <span className="mono-label mb-2 block text-muted">Новый пароль</span>
            <div className="flex gap-2">
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="минимум 6 символов"
                className="h-11 min-w-0 flex-1 rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
              />
              <button
                type="button"
                onClick={gen}
                className="h-11 shrink-0 rounded-btn border border-line-strong px-3 text-small font-semibold text-muted transition-colors hover:text-fg"
              >
                Сгенерировать
              </button>
            </div>
            {result && !result.ok && (
              <p className="mt-3 border-l-2 border-l-err bg-err-bg px-3 py-2 text-caption text-err-ink">
                {result.text}
              </p>
            )}
            <div className="mt-5 flex gap-2">
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
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="mono-label mb-5 text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-chip border border-dashed border-line px-4 py-8 text-center text-body text-muted">
      {children}
    </div>
  )
}
