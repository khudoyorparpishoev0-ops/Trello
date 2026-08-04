import { useState } from 'react'
import {
  SquareKanban,
  LayoutDashboard,
  Calendar,
  BarChart3,
  Settings,
  ChevronRight,
  Plus,
  LogOut,
  X,
  Building2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useAuth } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

export type AppView = 'board' | 'dashboard' | 'company' | 'calendar' | 'reports' | 'profile'

const NAV: { icon: LucideIcon; label: string; view?: AppView }[] = [
  { icon: SquareKanban, label: 'Доски', view: 'board' },
  { icon: LayoutDashboard, label: 'Дашборд', view: 'dashboard' },
  { icon: Calendar, label: 'Календарь', view: 'calendar' },
  { icon: Building2, label: 'Компания', view: 'company' },
  { icon: BarChart3, label: 'Отчёты', view: 'reports' },
]

interface SidebarContentProps {
  activeView: AppView
  onSelectView: (v: AppView) => void
  onNavigate?: () => void
}

/** Внутреннее наполнение боковой панели. Переиспользуется на десктопе и в мобильном drawer. */
export function SidebarContent({ activeView, onSelectView, onNavigate }: SidebarContentProps) {
  const { state, boards, activeBoardId, actions } = useBoard()
  const { authActive, user: authUser, logout } = useAuth()
  const [creating, setCreating] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  const submitBoard = () => {
    const n = newBoardName.trim()
    if (!n) return
    actions.addBoard(n)
    setNewBoardName('')
    setCreating(false)
    onSelectView('board')
    onNavigate?.()
  }
  // Если вошли по личному аккаунту — показываем его; иначе участника доски.
  const user: User = authUser
    ? {
        id: authUser.id ?? 'me',
        name: authUser.name,
        initials: authUser.initials,
        color: authUser.color,
        avatar: authUser.avatar,
        role: authUser.role as User['role'],
        online: true,
      }
    : state.users[state.currentUserId]
  const roleLabel = user.role === 'admin' ? 'Админ пространства' : 'Участник'

  const go = (view?: AppView) => {
    if (view) onSelectView(view)
    onNavigate?.()
  }

  return (
    <>
      {/* Логотип */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand">
          <SquareKanban size={18} strokeWidth={2.5} className="text-white" />
        </span>
        <div className="leading-tight">
          <div className="text-small font-bold tracking-tight text-fg">IT-HONA</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
            TaskBoard
          </div>
        </div>
      </div>

      {/* Навигация */}
      <nav className="px-3 py-2">
        {NAV.map((item) => {
          const active = item.view !== undefined && item.view === activeView
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.view)}
              className={cn(
                'flex w-full items-center gap-3 rounded-btn px-3 py-2 text-small font-medium transition-colors duration-200 ease-smooth',
                active ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-pill bg-brand" />}
            </button>
          )
        })}
      </nav>

      {/* Рабочее пространство */}
      <div className="mt-2 flex items-center justify-between px-5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Рабочее пространство
        </span>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          aria-label="Создать доску"
          title="Создать доску"
          className="rounded-[6px] p-0.5 text-faint transition-colors hover:bg-hover hover:text-fg"
        >
          {creating ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
        </button>
      </div>
      <div className="px-3">
        <div className="mb-1 px-3 text-caption font-semibold text-muted">{state.workspace.name}</div>

        {boards.map((b) => {
          const active = b.id === activeBoardId && activeView === 'board'
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                actions.switchBoard(b.id)
                go('board')
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-btn px-3 py-2 text-small transition-colors duration-200 ease-smooth',
                active ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              <span className={cn('h-2 w-2 rounded-[4px]', active ? 'bg-brand' : 'bg-line-strong')} />
              <span className="truncate">{b.name}</span>
              {active && <ChevronRight size={14} strokeWidth={2} className="ml-auto" />}
            </button>
          )
        })}

        {creating && (
          <div className="mt-1 px-1">
            <input
              autoFocus
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitBoard()
                if (e.key === 'Escape') {
                  setNewBoardName('')
                  setCreating(false)
                }
              }}
              placeholder="Название доски…"
              className="w-full rounded-input border border-line bg-bg px-3 py-2 text-small text-fg outline-none focus:border-brand placeholder:text-faint"
            />
            <button
              type="button"
              onClick={submitBoard}
              className="mt-1.5 w-full rounded-btn bg-brand px-3 py-1.5 text-caption font-medium text-white hover:bg-[#15913f]"
            >
              Создать
            </button>
          </div>
        )}
      </div>

      {/* Пользователь */}
      <div className="mt-auto border-t border-line p-3">
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-btn px-2 py-2 transition-colors',
            activeView === 'profile' ? 'bg-hover' : 'hover:bg-hover',
          )}
        >
          <button
            type="button"
            onClick={() => go('profile')}
            title="Мой профиль"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <Avatar user={user} size="md" showStatus />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-small font-medium text-fg">{user.name}</span>
              <span className="block truncate text-caption text-faint">{roleLabel}</span>
            </span>
          </button>
          {authActive ? (
            <button
              type="button"
              onClick={() => void logout()}
              title="Выйти"
              aria-label="Выйти"
              className="shrink-0 rounded-btn p-1.5 text-muted transition-colors hover:bg-hover hover:text-error"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          ) : (
            <Settings size={16} strokeWidth={2} className="shrink-0 text-muted" />
          )}
        </div>
      </div>
    </>
  )
}

interface SidebarProps {
  activeView: AppView
  onSelectView: (v: AppView) => void
}

/** Боковая панель для десктопа (скрыта на узких экранах — там мобильное меню). */
export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-sidebar lg:flex">
      <SidebarContent activeView={activeView} onSelectView={onSelectView} />
    </aside>
  )
}
