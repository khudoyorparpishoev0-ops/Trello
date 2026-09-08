import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { BarChart3, Bell, Calendar, Check, Clock, Plus, RefreshCw, Timer, User, type LucideIcon } from 'lucide-react'
import type { Priority, User as TUser } from '@/types'
import { useBoard } from '@/store/boardStore'
import { PRIORITY_META, PRIORITY_ORDER } from '@/lib/design'
import { cn } from '@/lib/utils'

/**
 * Стикеры и исполнители на карточке (ТЗ «Стикеры и исполнители»).
 * Единый поповер трёх видов (стикеры / исполнители / приоритет) рендерится
 * на корневом уровне через портал как position: fixed — иначе колонка с
 * overflow-y: auto обрезала бы его. Позиция считается от кнопки-триггера,
 * после монтирования измеряется реальная высота и при нехватке места снизу
 * поповер разворачивается вверх (флаг placed предотвращает цикл пересчёта).
 */

type MenuKind = 'sticker' | 'assignee' | 'prio'
type ToggleKey = 'repeat' | 'stopwatch' | 'tracking' | 'reminder'

interface MenuState {
  kind: MenuKind
  cardId: string
  x: number
  y: number
  tTop: number
  w: number
  placed: boolean
}

interface StickerMenuValue {
  openStickerMenu: (cardId: string, e: MouseEvent) => void
  openAssigneeMenu: (cardId: string, e: MouseEvent) => void
}

const StickerMenuContext = createContext<StickerMenuValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useStickerMenu(): StickerMenuValue {
  const ctx = useContext(StickerMenuContext)
  if (!ctx) throw new Error('useStickerMenu must be used within StickerMenuProvider')
  return ctx
}

const STICKER_ITEMS: { k: MenuKind | 'due' | ToggleKey; label: string; icon: LucideIcon }[] = [
  { k: 'assignee', label: 'Исполнитель', icon: User },
  { k: 'due', label: 'Дедлайн', icon: Calendar },
  { k: 'prio', label: 'Приоритет', icon: BarChart3 },
  { k: 'repeat', label: 'Регулярная задача', icon: RefreshCw },
  { k: 'stopwatch', label: 'Секундомер', icon: Timer },
  { k: 'tracking', label: 'Таймтрекинг', icon: Clock },
  { k: 'reminder', label: 'Напоминание', icon: Bell },
]

export function StickerMenuProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useBoard()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [query, setQuery] = useState('')
  const popRef = useRef<HTMLDivElement>(null)

  const open = useCallback((kind: MenuKind, cardId: string, e: MouseEvent) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const w = kind === 'assignee' ? 320 : 236
    const x = Math.max(12, Math.min(r.left, window.innerWidth - w - 12))
    setMenu({ kind, cardId, x, y: r.bottom + 6, tTop: r.top, w, placed: false })
    setQuery('')
  }, [])

  const value = useMemo<StickerMenuValue>(
    () => ({
      openStickerMenu: (cardId, e) => open('sticker', cardId, e),
      openAssigneeMenu: (cardId, e) => open('assignee', cardId, e),
    }),
    [open],
  )

  const close = () => {
    setMenu(null)
    setQuery('')
  }

  // Смена вида (стикеры → исполнители/приоритет): другая ширина и высота —
  // пересчитываем размещение (placed:false) и заново клампим x под ширину.
  const switchView = (kind: MenuKind) => {
    setMenu((m) => {
      if (!m) return m
      const w = kind === 'assignee' ? 320 : 236
      const x = Math.max(12, Math.min(m.x, window.innerWidth - w - 12))
      return { ...m, kind, w, x, placed: false }
    })
    setQuery('')
  }

  // После монтирования/смены вида измеряем реальную высоту и при нехватке
  // места снизу разворачиваем вверх — до отрисовки (useLayoutEffect).
  useLayoutEffect(() => {
    if (!menu || menu.placed) return
    const el = popRef.current
    if (!el) return
    const h = el.offsetHeight
    const vh = window.innerHeight
    let y = menu.y
    if (y + h > vh - 12) y = Math.max(12, menu.tTop - h - 6)
    setMenu((m) => (m ? { ...m, y, placed: true } : m))
  }, [menu])

  const card = menu ? state.cards[menu.cardId] : null

  const pickSticker = (k: (typeof STICKER_ITEMS)[number]['k']) => {
    if (!card) return
    if (k === 'assignee' || k === 'prio') {
      switchView(k)
      return
    }
    if (k === 'due') {
      if (!card.dueDate) {
        const n = new Date()
        actions.updateCard(card.id, {
          dueDate: new Date(n.getFullYear(), n.getMonth(), n.getDate(), 18, 0, 0).toISOString(),
        })
      }
      close()
      return
    }
    const key = k as ToggleKey
    const cur = card.stickers ?? {}
    actions.updateCard(card.id, { stickers: { ...cur, [key]: !cur[key] } })
    close()
  }

  const togglePerson = (uid: string) => {
    if (!card) return
    const has = card.assigneeIds.includes(uid)
    actions.updateCard(card.id, {
      assigneeIds: has ? card.assigneeIds.filter((id) => id !== uid) : [...card.assigneeIds, uid],
    })
  }

  const detachAll = () => {
    if (card) actions.updateCard(card.id, { assigneeIds: [] })
  }

  const addEveryoneToProject = () => {
    if (state.board) actions.setBoardMembers(state.board.id, Object.values(state.users))
  }

  const pickPrio = (p: Priority) => {
    if (!card) return
    actions.setPriority(card.id, p)
    close()
  }

  const members = (state.board?.memberIds ?? []).map((id) => state.users[id]).filter(Boolean) as TUser[]
  const q = query.trim().toLowerCase()
  const filtered = q
    ? members.filter((u) => u.name.toLowerCase().includes(q) || (u.department ?? '').toLowerCase().includes(q))
    : members
  const hasNonMembers = Object.keys(state.users).length > members.length

  return (
    <StickerMenuContext.Provider value={value}>
      {children}
      {menu &&
        card &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[50]" onClick={close} aria-hidden />
            <div
              ref={popRef}
              data-sticker-popover={menu.kind}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: menu.x,
                top: menu.y,
                width: menu.w,
              }}
              className="z-[51] max-h-[calc(100vh-24px)] overflow-y-auto rounded-card border border-line bg-elevated shadow-md animate-slide-up"
            >
              {/* Меню «Добавить стикер» */}
              {menu.kind === 'sticker' && (
                <div className="p-1.5">
                  <div className="mono-label px-2.5 pb-2 pt-2 text-faint">Добавить стикер</div>
                  {STICKER_ITEMS.map(({ k, label, icon: Icon }) => {
                    const on = (['repeat', 'stopwatch', 'tracking', 'reminder'] as string[]).includes(k) &&
                      Boolean(card.stickers?.[k as ToggleKey])
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pickSticker(k)}
                        className={cn(
                          'flex min-h-[40px] w-full items-center gap-3 rounded-chip px-2.5 py-2 text-left text-small transition-colors hover:bg-hover',
                          on ? 'font-semibold text-brand-ink' : 'text-fg',
                        )}
                      >
                        <Icon size={18} strokeWidth={1.6} className="shrink-0" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Поповер «Исполнитель» */}
              {menu.kind === 'assignee' && (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-2.5 px-3.5 pb-2.5 pt-3">
                    <span className="mono-label text-muted">Стикер «Исполнитель»</span>
                    <button
                      type="button"
                      onClick={detachAll}
                      className="text-caption font-semibold text-brand-ink hover:underline"
                    >
                      Открепить
                    </button>
                  </div>
                  <div className="px-3.5 pb-2.5">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск по списку (имя, отдел)"
                      className="h-10 w-full rounded-chip border border-line-strong bg-mist px-3 text-small text-fg outline-none transition-colors placeholder:text-faint focus:border-brand"
                    />
                  </div>
                  <div className="mono-label grid grid-cols-[1fr_96px_20px] gap-2.5 border-b border-line px-3.5 pb-2 text-faint">
                    <span>Имя</span>
                    <span>Отдел</span>
                    <span />
                  </div>
                  <div className="max-h-[260px] overflow-y-auto p-1.5">
                    {filtered.length === 0 && (
                      <div className="px-2 py-6 text-center text-caption text-faint">Никого не найдено</div>
                    )}
                    {filtered.map((u) => {
                      const on = card.assigneeIds.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => togglePerson(u.id)}
                          className="grid min-h-[44px] w-full grid-cols-[1fr_96px_20px] items-center gap-2.5 rounded-chip p-2 text-left transition-colors hover:bg-hover"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <PersonAvatar user={u} />
                            <span className={cn('truncate text-small', on ? 'font-semibold text-fg' : 'text-muted')}>
                              {u.name}
                            </span>
                          </span>
                          <span className="truncate text-caption text-faint">{u.department ?? '—'}</span>
                          <span className="flex h-5 w-5 items-center justify-center text-brand-ink">
                            {on && <Check size={15} strokeWidth={2.4} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {hasNonMembers && (
                    <button
                      type="button"
                      onClick={addEveryoneToProject}
                      className="flex min-h-[44px] items-center gap-2 border-t border-line px-3.5 py-3 text-small font-semibold text-brand-ink transition-colors hover:bg-hover"
                    >
                      <Plus size={16} strokeWidth={1.6} /> Добавить сотрудников в проект
                    </button>
                  )}
                </div>
              )}

              {/* Поповер «Приоритет» */}
              {menu.kind === 'prio' && (
                <div className="p-1.5">
                  <div className="mono-label px-2.5 pb-2 pt-2 text-faint">Приоритет</div>
                  {PRIORITY_ORDER.map((p) => {
                    const meta = PRIORITY_META[p]
                    const on = card.priority === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => pickPrio(p)}
                        className={cn(
                          'flex min-h-[40px] w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left text-small transition-colors hover:bg-hover',
                          on ? 'font-semibold' : 'font-normal',
                        )}
                      >
                        <span className="h-2 w-2 shrink-0" style={{ background: meta.color }} aria-hidden />
                        <span className="flex-1 text-fg">{meta.label}</span>
                        {on && <Check size={15} strokeWidth={2.4} className="shrink-0 text-brand-ink" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </StickerMenuContext.Provider>
  )
}

/** Аватар 28×28 для списка исполнителей (фото либо инициалы, квадрат радиус 2). */
function PersonAvatar({ user }: { user: TUser }) {
  if (user.avatar) {
    return (
      <img src={user.avatar} alt="" className="h-7 w-7 shrink-0 rounded-chip border border-line object-cover" />
    )
  }
  return (
    <span className="mono-data flex h-7 w-7 shrink-0 items-center justify-center rounded-chip border border-line bg-mist text-muted">
      {user.initials}
    </span>
  )
}
