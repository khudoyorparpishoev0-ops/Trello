import { useState } from 'react'
import { Lock, Image as ImageIcon, Filter, Check } from 'lucide-react'
import type { Filters } from '@/components/board/Board'
import { BoardBackgroundModal } from '@/components/board/BoardBackgroundModal'
import { useBoard } from '@/store/boardStore'
import { useRouter } from '@/store/router'
import { ScreenHeader } from './ScreenHeader'
import type { BoardViewKind } from '@/lib/route'
import { cn } from '@/lib/utils'

const VIEWS: { k: BoardViewKind; label: string }[] = [
  { k: 'board', label: 'Доска' },
  { k: 'timeline', label: 'Таймлайн' },
  { k: 'table', label: 'Таблица' },
]

interface TopBarProps {
  filters: Filters
  onFiltersChange: (f: Filters) => void
  onMenuClick: () => void
}

export function TopBar({ filters, onFiltersChange, onMenuClick }: TopBarProps) {
  const { state } = useBoard()
  const { route, navigate } = useRouter()
  const boardView = route.boardView
  const [bgOpen, setBgOpen] = useState(false)
  const members = state.board.memberIds.map((id) => state.users[id]).filter(Boolean)

  return (
    <>
      <ScreenHeader
        kicker="Рабочее пространство"
        title={state.board.name}
        subtitle="Канбан проекта, три вида и быстрые фильтры"
        onMenuClick={onMenuClick}
        members={members}
        search={{
          value: filters.query,
          onChange: (query) => onFiltersChange({ ...filters, query }),
          placeholder: 'Поиск карточек',
        }}
        badge={
          <span className="mono-label inline-flex items-center gap-1.5 bg-mist px-2 py-1 text-muted">
            <Lock size={13} strokeWidth={1.6} />
            Приватная
          </span>
        }
      >
        {/* Сегменты видов: заливка активного — токен --fill, без скруглений внутри рамки */}
        <div className="flex shrink-0 overflow-hidden rounded-chip border border-line">
          {VIEWS.map(({ k, label }) => {
            const active = boardView === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => navigate({ boardView: k })}
                className={cn(
                  'h-9 px-3 text-body transition-colors ease-smooth',
                  active
                    ? 'bg-brand-fill font-semibold text-white'
                    : 'bg-surface text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <span className="mono-label hidden items-center gap-1.5 text-faint sm:flex">
          <Filter size={14} strokeWidth={1.6} />
          Фильтры
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={filters.onlyMine}
            onClick={() => onFiltersChange({ ...filters, onlyMine: !filters.onlyMine })}
          >
            Мои карточки
          </FilterChip>
          <FilterChip
            active={filters.overdue}
            tone="err"
            onClick={() => onFiltersChange({ ...filters, overdue: !filters.overdue })}
          >
            Просрочено
          </FilterChip>
        </div>

        <button
          type="button"
          onClick={() => setBgOpen(true)}
          className="mono-label ml-auto hidden items-center gap-1.5 px-2 py-1 text-muted transition-colors hover:text-fg sm:inline-flex"
        >
          <ImageIcon size={14} strokeWidth={1.6} />
          Фон доски
        </button>
      </ScreenHeader>

      {bgOpen && <BoardBackgroundModal onClose={() => setBgOpen(false)} />}
    </>
  )
}

/**
 * Чип быстрого фильтра. Включённый — плашка статуса с левой линией 2px;
 * выключенный — нейтральная обводка. Скруглений нет.
 */
function FilterChip({
  active,
  tone = 'ok',
  onClick,
  children,
}: {
  active: boolean
  tone?: 'ok' | 'err'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'mono-label inline-flex items-center gap-1.5 px-2 py-1.5 transition-colors ease-smooth',
        active
          ? tone === 'err'
            ? 'border-l-2 border-l-err bg-err-bg text-err-ink'
            : 'border-l-2 border-l-brand bg-brand-bg text-brand-ink'
          : 'border border-line bg-mist text-muted hover:text-fg',
      )}
    >
      {active && <Check size={13} strokeWidth={2.4} />}
      {children}
    </button>
  )
}
