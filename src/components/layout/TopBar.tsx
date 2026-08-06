import { useState } from 'react'
import {
  Lock,
  Search,
  Sun,
  Moon,
  Bell,
  UserPlus,
  SlidersHorizontal,
  Check,
  Menu,
  Cloud,
  CloudOff,
  Image as ImageIcon,
} from 'lucide-react'
import type { Filters } from '@/components/board/Board'
import { BoardBackgroundModal } from '@/components/board/BoardBackgroundModal'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

/** Вид доски в сегментированном переключателе. */
export type BoardViewKind = 'board' | 'timeline' | 'table'

const VIEWS: { k: BoardViewKind; label: string }[] = [
  { k: 'board', label: 'Доска' },
  { k: 'timeline', label: 'Таймлайн' },
  { k: 'table', label: 'Таблица' },
]

interface TopBarProps {
  filters: Filters
  onFiltersChange: (f: Filters) => void
  onMenuClick: () => void
  boardView: BoardViewKind
  onBoardViewChange: (v: BoardViewKind) => void
}

export function TopBar({ filters, onFiltersChange, onMenuClick, boardView, onBoardViewChange }: TopBarProps) {
  const { state, mode } = useBoard()
  const { theme, toggle } = useTheme()
  const [bgOpen, setBgOpen] = useState(false)
  const members = state.board.memberIds.map((id) => state.users[id]).filter(Boolean)

  return (
    <header className="shrink-0 border-b border-line bg-bg">
      {/* Верхний ряд */}
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
        {/* Бургер-меню (только на узких экранах) */}
        <IconButton
          icon={Menu}
          label="Меню"
          size="sm"
          onClick={onMenuClick}
          className="-ml-1 shrink-0 lg:hidden"
        />

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <h1 className="truncate text-h3 font-semibold text-fg">{state.board.name}</h1>
          <span className="hidden items-center gap-1 rounded-pill bg-hover px-2 py-0.5 text-caption font-medium text-muted sm:inline-flex">
            <Lock size={12} strokeWidth={2} />
            Приватная
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Поиск */}
          <div className="relative hidden sm:block">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={filters.query}
              onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
              placeholder="Поиск карточек…"
              className="h-9 w-44 rounded-input border border-line bg-surface pl-9 pr-3 text-small text-fg outline-none transition-colors focus:border-brand focus:w-56 placeholder:text-faint"
            />
          </div>

          {/* Присутствие */}
          <div className="hidden items-center md:flex">
            {members.slice(0, 4).map((u, i) => (
              <span key={u.id} className={cn(i > 0 && '-ml-2')}>
                <Avatar user={u} size="md" showStatus />
              </span>
            ))}
          </div>

          {mode !== 'loading' && (
            <span
              title={
                mode === 'server'
                  ? 'Данные сохраняются на сервере'
                  : 'Локальный режим — сервер недоступен, изменения не сохраняются'
              }
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-btn',
                mode === 'server' ? 'text-success' : 'text-warning',
              )}
            >
              {mode === 'server' ? (
                <Cloud size={16} strokeWidth={2} />
              ) : (
                <CloudOff size={16} strokeWidth={2} />
              )}
            </span>
          )}
          <IconButton icon={ImageIcon} label="Фон доски" size="sm" onClick={() => setBgOpen(true)} />
          <IconButton icon={Bell} label="Уведомления" size="sm" className="hidden sm:inline-flex" />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            size="sm"
            onClick={toggle}
          />
          <Button size="sm" icon={UserPlus}>
            <span className="hidden sm:inline">Пригласить</span>
          </Button>
        </div>
      </div>

      {/* Нижний ряд: виды + фильтры (прокручивается по горизонтали на узких экранах) */}
      <div className="flex items-center gap-3 overflow-x-auto px-4 pb-3 no-scrollbar sm:px-6">
        <div className="flex shrink-0 items-center gap-1 rounded-btn bg-surface-2 p-1">
          {VIEWS.map(({ k, label }) => {
            const active = boardView === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => onBoardViewChange(k)}
                className={cn(
                  'rounded-[10px] px-3 py-1 text-caption font-medium transition-colors duration-200',
                  active ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 text-caption text-faint sm:flex">
            <SlidersHorizontal size={14} strokeWidth={2} />
            Быстрые фильтры:
          </span>
          <FilterChip
            active={filters.onlyMine}
            onClick={() => onFiltersChange({ ...filters, onlyMine: !filters.onlyMine })}
          >
            Мои карточки
          </FilterChip>
          <FilterChip
            active={filters.overdue}
            tone="error"
            onClick={() => onFiltersChange({ ...filters, overdue: !filters.overdue })}
          >
            Просрочено
          </FilterChip>
        </div>
      </div>

      {bgOpen && <BoardBackgroundModal onClose={() => setBgOpen(false)} />}
    </header>
  )
}

function FilterChip({
  active,
  tone = 'brand',
  onClick,
  children,
}: {
  active: boolean
  tone?: 'brand' | 'error'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-caption font-medium transition-colors duration-200 ease-smooth',
        active
          ? tone === 'error'
            ? 'border-transparent bg-error-soft text-error'
            : 'border-transparent bg-brand-soft text-brand'
          : 'border-line text-muted hover:border-line-strong hover:text-fg',
      )}
    >
      {active && <Check size={13} strokeWidth={2.5} />}
      {children}
    </button>
  )
}
