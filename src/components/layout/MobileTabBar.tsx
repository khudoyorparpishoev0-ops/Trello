import { LayoutDashboard, Columns3, Calendar, ListChecks, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRouter } from '@/store/router'
import { cn } from '@/lib/utils'

interface MobileTabBarProps {
  /** Включён ли фильтр «Мои карточки» — вкладка «Задачи» это он и есть. */
  onlyMine: boolean
  onToggleOnlyMine: (value: boolean) => void
  onMore: () => void
}

/**
 * Нижняя навигация для телефонов: тёмно-зелёная панель в тон сайдбару,
 * пять пунктов, зоны нажатия ≥44px, учёт безопасной зоны снизу.
 */
export function MobileTabBar({ onlyMine, onToggleOnlyMine, onMore }: MobileTabBarProps) {
  const { route, navigate } = useRouter()
  const activeView = route.view
  const boardMine = activeView === 'board' && onlyMine
  const boardAll = activeView === 'board' && !onlyMine
  /**
   * «Задачи» — это доска с включённым фильтром «Мои карточки». Фильтр в адрес
   * не пишется: это состояние работы, а не место, куда дают ссылку.
   */
  const openBoard = (mine: boolean) => {
    onToggleOnlyMine(mine)
    navigate({ view: 'board', cardId: null })
  }
  const tabs: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }[] = [
    {
      icon: LayoutDashboard,
      label: 'Дашборд',
      active: activeView === 'dashboard',
      onClick: () => navigate({ view: 'dashboard', cardId: null }),
    },
    { icon: Columns3, label: 'Доска', active: boardAll, onClick: () => openBoard(false) },
    {
      icon: Calendar,
      label: 'Календарь',
      active: activeView === 'calendar',
      onClick: () => navigate({ view: 'calendar', cardId: null }),
    },
    { icon: ListChecks, label: 'Задачи', active: boardMine, onClick: () => openBoard(true) },
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
