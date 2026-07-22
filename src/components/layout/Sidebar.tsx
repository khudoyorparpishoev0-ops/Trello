import {
  SquareKanban,
  LayoutDashboard,
  Calendar,
  Users,
  BarChart3,
  Settings,
  ChevronRight,
  Plus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const NAV: { icon: LucideIcon; label: string; active?: boolean }[] = [
  { icon: SquareKanban, label: 'Доски', active: true },
  { icon: LayoutDashboard, label: 'Дашборд' },
  { icon: Calendar, label: 'Календарь' },
  { icon: Users, label: 'Команда' },
  { icon: BarChart3, label: 'Отчёты' },
]

/** Внутреннее наполнение боковой панели. Переиспользуется на десктопе и в мобильном drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { state } = useBoard()
  const user = state.users[state.currentUserId]
  const roleLabel = user.role === 'admin' ? 'Админ пространства' : 'Участник'

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
        {NAV.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={onNavigate}
            className={cn(
              'flex w-full items-center gap-3 rounded-btn px-3 py-2 text-small font-medium transition-colors duration-200 ease-smooth',
              item.active ? 'bg-hover text-fg' : 'text-muted hover:bg-hover hover:text-fg',
            )}
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
            {item.active && <span className="ml-auto h-1.5 w-1.5 rounded-pill bg-brand" />}
          </button>
        ))}
      </nav>

      {/* Рабочее пространство */}
      <div className="mt-2 flex items-center justify-between px-5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          Рабочее пространство
        </span>
        <Plus size={14} strokeWidth={2} className="text-faint" />
      </div>
      <div className="px-3">
        <div className="mb-1 px-3 text-caption font-semibold text-muted">{state.workspace.name}</div>
        {state.workspace.boards.map((b) => {
          const active = b.id === state.board.id
          return (
            <button
              key={b.id}
              type="button"
              onClick={onNavigate}
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
      </div>

      {/* Пользователь */}
      <div className="mt-auto border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-btn px-2 py-2 hover:bg-hover">
          <Avatar user={user} size="md" showStatus />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-small font-medium text-fg">{user.name}</div>
            <div className="truncate text-caption text-faint">{roleLabel}</div>
          </div>
          <Settings size={16} strokeWidth={2} className="shrink-0 text-muted" />
        </div>
      </div>
    </>
  )
}

/** Боковая панель для десктопа (скрыта на узких экранах — там мобильное меню). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface-2 lg:flex">
      <SidebarContent />
    </aside>
  )
}
