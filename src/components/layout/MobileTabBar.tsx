import { LayoutDashboard, Columns3, Calendar, ListChecks, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AppView } from './Sidebar'
import { cn } from '@/lib/utils'

interface MobileTabBarProps {
  activeView: AppView
  onlyMine: boolean
  onDashboard: () => void
  onBoard: () => void
  onTasks: () => void
  onCalendar: () => void
  onMore: () => void
}

/**
 * Нижняя навигация для телефонов: тёмно-зелёная панель в тон сайдбару,
 * пять пунктов, зоны нажатия ≥44px, учёт безопасной зоны снизу.
 */
export function MobileTabBar({
  activeView, onlyMine, onDashboard, onBoard, onTasks, onCalendar, onMore,
}: MobileTabBarProps) {
  const boardMine = activeView === 'board' && onlyMine
  const boardAll = activeView === 'board' && !onlyMine
  const tabs: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }[] = [
    { icon: LayoutDashboard, label: 'Дашборд', active: activeView === 'dashboard', onClick: onDashboard },
    { icon: Columns3, label: 'Доска', active: boardAll, onClick: onBoard },
    { icon: Calendar, label: 'Календарь', active: activeView === 'calendar', onClick: onCalendar },
    { icon: ListChecks, label: 'Задачи', active: boardMine, onClick: onTasks },
    { icon: MoreHorizontal, label: 'Ещё', active: false, onClick: onMore },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-sidebar-line bg-sidebar px-2 pt-2 lg:hidden"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {tabs.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={t.onClick}
          className={cn(
            'flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-chip px-1 transition-colors',
            t.active ? 'text-sidebar-accent' : 'text-sidebar-muted active:bg-sidebar-active',
          )}
        >
          <t.icon size={20} strokeWidth={1.6} />
          <span className={cn('text-[11px] leading-none', t.active ? 'font-semibold' : 'font-medium')}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
