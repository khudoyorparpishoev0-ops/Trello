import { useState } from 'react'
import {
  LayoutDashboard,
  Columns3,
  Users,
  Calendar,
  Building2,
  BarChart3,
  Settings2,
  ChevronRight,
  Plus,
  X,
  Folder,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { User as TUser } from '@/types'
import { useBoard, type BoardSummary } from '@/store/boardStore'
import { useAuth } from '@/store/auth'
import { useRouter } from '@/store/router'
import type { AppView } from '@/lib/route'
import { Avatar } from '@/components/ui/Avatar'
import { CoreWordmark } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

/**
 * Порядок пунктов фиксирован брендбуком (Digital §06). «Отчёты» стоят шестыми:
 * экран был реализован, но в прежнем меню отсутствовал и оставался недостижим.
 */
const NAV: { icon: LucideIcon; label: string; view: AppView }[] = [
  { icon: LayoutDashboard, label: 'Дашборд', view: 'dashboard' },
  { icon: Columns3, label: 'Доска', view: 'board' },
  { icon: Users, label: 'Команда', view: 'team' },
  { icon: Calendar, label: 'Календарь', view: 'calendar' },
  { icon: Building2, label: 'Компания', view: 'company' },
  { icon: BarChart3, label: 'Отчёты', view: 'reports' },
  { icon: Settings2, label: 'Настройки', view: 'profile' },
]

/** Цвет точки проекта: есть просрочки → тревога, есть работа → зелёный, пусто → серый. */
function projectDot(b: BoardSummary): string {
  if (b.overdue > 0) return '#E0A126'
  if (b.active > 0) return '#33C561'
  return '#8E9A91'
}

interface SidebarContentProps {
  /** Закрыть мобильное меню после перехода. */
  onNavigate?: () => void
}

/** Наполнение боковой панели. Переиспользуется на десктопе и в мобильном drawer. */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { state, boards, activeBoardId, actions } = useBoard()
  const { route, navigate } = useRouter()
  const activeView = route.view
  const { authActive, user: authUser, logout } = useAuth()
  const [creating, setCreating] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  const submitBoard = () => {
    const n = newBoardName.trim()
    if (!n) return
    // Доска создаётся с новым id, поэтому в адрес её подставит синхронизация
    // в App — здесь достаточно перейти в раздел доски.
    actions.addBoard(n)
    setNewBoardName('')
    setCreating(false)
    navigate({ view: 'board', boardId: null, boardView: 'board', cardId: null })
    onNavigate?.()
  }

  // Если вошли по личному аккаунту — показываем его; иначе участника доски.
  const user: TUser = authUser
    ? {
        id: authUser.id ?? 'me',
        name: authUser.name,
        initials: authUser.initials,
        color: authUser.color,
        avatar: authUser.avatar,
        role: authUser.role as TUser['role'],
        online: true,
      }
    : state.users[state.currentUserId]
  const roleLabel = user.role === 'admin' ? 'Администратор' : 'Участник'

  const go = (view: AppView) => {
    navigate({ view, cardId: null })
    onNavigate?.()
  }
  const openBoard = (boardId: string) => {
    navigate({ view: 'board', boardId, boardView: 'board', cardId: null })
    onNavigate?.()
  }

  return (
    <>
      <div className="px-4 pb-6">
        <CoreWordmark />
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = item.view === activeView
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => go(item.view)}
              className={cn(
                'flex min-h-[44px] w-full items-center gap-3 rounded-chip px-3 py-2.5 text-left text-body transition-colors ease-smooth',
                active
                  ? 'bg-sidebar-active font-semibold text-white'
                  : 'text-sidebar-fg hover:bg-sidebar-active/60',
              )}
            >
              <item.icon size={20} strokeWidth={1.6} className="shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Проекты пространства */}
      <div className="mt-8 px-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="mono-label text-sidebar-muted">Проекты</span>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            aria-label={creating ? 'Отменить создание' : 'Новый проект'}
            title={creating ? 'Отменить создание' : 'Новый проект'}
            className="flex h-7 w-7 items-center justify-center rounded-chip border border-sidebar-line text-sidebar-fg transition-colors hover:bg-sidebar-active"
          >
            {creating ? <X size={14} strokeWidth={1.6} /> : <Plus size={14} strokeWidth={1.6} />}
          </button>
        </div>

        {creating && (
          <div className="mb-2">
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
              placeholder="Название проекта…"
              className="h-11 w-full rounded-chip border border-sidebar-line bg-transparent px-3 text-body text-white outline-none placeholder:text-sidebar-muted focus:border-sidebar-accent"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {boards.map((b) => {
            const active = b.id === activeBoardId && activeView === 'board'
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => openBoard(b.id)}
                className={cn(
                  'flex min-h-[56px] w-full items-center gap-3 rounded-chip px-3 py-2 text-left transition-colors ease-smooth',
                  active ? 'bg-white/[0.07] shadow-[inset_3px_0_0_#33C561]' : 'hover:bg-white/[0.04]',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: projectDot(b) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-body leading-[22px] text-white',
                      active ? 'font-semibold' : 'font-normal',
                    )}
                  >
                    {b.name}
                  </span>
                  <span className="block truncate text-caption text-sidebar-muted">
                    {b.total === 0
                      ? 'Пока нет задач'
                      : `Готово ${b.total - b.active} из ${b.total}${b.overdue > 0 ? ` · ${b.overdue} просроч.` : ''}`}
                  </span>
                </span>
                <span className="mono-data shrink-0 text-[13px] text-sidebar-fg">{b.active}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => go('company')}
            className="mt-1 flex min-h-[48px] items-center gap-3 border-t border-sidebar-line px-3 text-left text-body text-sidebar-fg transition-colors hover:text-white"
          >
            <Folder size={18} strokeWidth={1.6} className="shrink-0" />
            <span className="flex-1">Все проекты</span>
            <ChevronRight size={18} strokeWidth={1.6} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* Пользователь */}
      <div className="mt-auto flex items-center gap-3 border-t border-sidebar-line px-4 pt-6">
        <button
          type="button"
          onClick={() => go('profile')}
          title="Мой профиль"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar user={user} size="md" tone="brand" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-caption font-semibold text-white">{user.name}</span>
            <span className="mono-data block truncate text-sidebar-muted">{roleLabel.toUpperCase()}</span>
          </span>
        </button>
        {authActive && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mono-data shrink-0 text-sidebar-muted transition-colors hover:text-white"
          >
            Выйти
          </button>
        )}
      </div>

      <div className="px-4 pt-4">
        <p className="mono-label text-sidebar-muted">IT-HONA CORE</p>
        <p className="mt-1 text-caption text-sidebar-muted">Системы. Люди. Развитие.</p>
      </div>
    </>
  )
}

/** Боковая панель десктопа: 240px, тёмно-зелёная в обеих темах (брендбук §06). */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto bg-sidebar py-6 lg:flex">
      <SidebarContent />
    </aside>
  )
}
