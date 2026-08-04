import { useMemo } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { isDoneList } from '@/lib/design'
import { dueStatus } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TeamProps {
  onMenuClick: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  member: 'Участник',
  observer: 'Наблюдатель',
}

// grid по спецификации §6: СОТРУДНИК · РОЛЬ · ОТДЕЛ · АКТИВНЫХ · ПРОСРОЧЕНО · ЗАГРУЗКА
const COLS = 'grid-cols-[2fr_1.3fr_1fr_0.7fr_0.7fr_1.4fr]'
const NORM = 4 // норма активных задач на человека

export function Team({ onMenuClick }: TeamProps) {
  const { state } = useBoard()
  const { theme, toggle } = useTheme()

  const rows = useMemo(() => {
    // Карта cardId → список (для определения статуса «Готово»).
    const listOf: Record<string, string> = {}
    for (const l of Object.values(state.lists)) for (const cid of l.cardIds) listOf[cid] = l.id

    return Object.values(state.users)
      .map((u) => {
        let active = 0
        let overdue = 0
        for (const c of Object.values(state.cards)) {
          if (!c.assigneeIds.includes(u.id)) continue
          const list = state.lists[listOf[c.id]]
          const done = list ? isDoneList(list.title) : false
          if (done) continue
          active++
          if (dueStatus(c.dueDate, done) === 'overdue') overdue++
        }
        return { u, active, overdue, load: Math.min(100, Math.round((active / NORM) * 100)) }
      })
      .sort((a, b) => b.active - a.active)
  }, [state.users, state.cards, state.lists])

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.01em] text-fg">Команда</h1>
          <span className="hidden text-caption text-faint sm:block">· {rows.length} чел.</span>
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
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <div className="min-w-[720px]">
              {/* Заголовки */}
              <div className={cn('grid items-center gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint', COLS)}>
                <span>Сотрудник</span>
                <span>Роль</span>
                <span>Отдел</span>
                <span className="text-right tabular-nums">Активных</span>
                <span className="text-right tabular-nums">Просрочено</span>
                <span>Загрузка</span>
              </div>

              {rows.map(({ u, active, overdue, load }) => (
                <div
                  key={u.id}
                  className={cn('grid items-center gap-3 border-t border-line px-5 py-[14px] transition-colors hover:bg-hover', COLS)}
                >
                  {/* Сотрудник */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative shrink-0">
                      <Avatar user={u} size="md" />
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-pill ring-2 ring-surface',
                          u.online ? 'bg-success' : 'bg-faint',
                        )}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-fg">{u.name}</div>
                      <div className="truncate text-[11.5px] text-faint">{u.online ? 'в сети' : 'не в сети'}</div>
                    </div>
                  </div>
                  {/* Роль */}
                  <span className="truncate text-small text-muted">{ROLE_LABEL[u.role ?? 'member'] ?? 'Участник'}</span>
                  {/* Отдел */}
                  <span className="truncate text-small text-muted">{u.department || '—'}</span>
                  {/* Активных */}
                  <span className="text-right text-small tabular-nums text-fg">{active}</span>
                  {/* Просрочено */}
                  <span className={cn('text-right text-small tabular-nums', overdue > 0 ? 'font-semibold text-error' : 'text-muted')}>
                    {overdue}
                  </span>
                  {/* Загрузка */}
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-track">
                      <div
                        className="h-full rounded-pill transition-[width] duration-300"
                        style={{ width: `${load}%`, background: load >= 90 ? '#EF4444' : load >= 70 ? '#F59E0B' : '#16A34A' }}
                      />
                    </div>
                    <span className="w-9 text-right text-[11.5px] font-medium tabular-nums text-muted">{load}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
