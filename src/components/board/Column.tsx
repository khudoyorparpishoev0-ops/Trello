import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  MoreHorizontal,
  Trash2,
  Plus,
  Pencil,
  Copy,
  ArrowLeft,
  ArrowRight,
  Flag,
  CalendarClock,
  ArrowDownAZ,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Card, Label, List, User } from '@/types'
import { KanbanCard } from './KanbanCard'
import { InlineComposer } from './InlineComposer'
import { IconButton } from '@/components/ui/IconButton'
import { useBoard } from '@/store/boardStore'
import { isDoneList, listAccentColor } from '@/lib/design'
import { cn } from '@/lib/utils'

const COLUMN_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#8E999D',
]

interface ColumnProps {
  list: List
  cards: Card[]
  users: Record<string, User>
  labels: Record<string, Label>
  onAddCard: (title: string) => void
  /** Добавить карточку в начало списка (кнопка вверху колонки). */
  onAddCardTop: (title: string) => void
  onRename: (title: string) => void
  onDelete: () => void
  onOpenCard: (cardId: string) => void
}

/** Список / колонка-стадия (ТЗ логики §4.2). Droppable-контейнер для карточек. */
export function Column({
  list,
  cards,
  users,
  labels,
  onAddCard,
  onAddCardTop,
  onRename,
  onDelete,
  onOpenCard,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: 'list' } })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)

  const accent = list.color || listAccentColor(list.title)
  const done = isDoneList(list.title)
  const overLimit = list.wipLimit !== undefined && cards.length > list.wipLimit
  const atLimit = list.wipLimit !== undefined && cards.length >= list.wipLimit

  const commitRename = () => {
    const v = title.trim()
    if (v && v !== list.title) onRename(v)
    else setTitle(list.title)
    setEditing(false)
  }
  const startRename = () => {
    setTitle(list.title)
    setEditing(true)
  }

  return (
    <section className="flex h-full w-[86vw] max-w-[320px] shrink-0 flex-col rounded-card bg-col sm:w-[300px]">
      {/* Шапка колонки */}
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: accent }} aria-hidden />
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setTitle(list.title)
                setEditing(false)
              }
            }}
            className="min-w-0 flex-1 rounded-[8px] bg-bg px-2 py-1 text-small font-semibold text-fg outline-none ring-1 ring-brand"
          />
        ) : (
          <h3
            className="min-w-0 flex-1 cursor-text truncate text-small font-semibold text-fg"
            onDoubleClick={startRename}
            title="Двойной клик — переименовать"
          >
            {list.title}
          </h3>
        )}
        <span
          className={cn(
            'shrink-0 rounded-pill px-1.5 text-caption font-medium tabular-nums',
            overLimit ? 'bg-error-soft text-error' : 'bg-hover text-muted',
          )}
          title={list.wipLimit !== undefined ? `WIP-лимит: ${list.wipLimit}` : undefined}
        >
          {cards.length}
          {list.wipLimit !== undefined && `/${list.wipLimit}`}
        </span>
        <ColumnMenu list={list} onRename={startRename} onDelete={onDelete} />
      </header>

      {atLimit && (
        <p className={cn('px-3 pb-1 text-[11px]', overLimit ? 'text-error' : 'text-warning')}>
          {overLimit ? 'Превышен WIP-лимит' : 'Достигнут WIP-лимит'}
        </p>
      )}

      {/* Добавить карточку — вверху колонки (вставка в начало) */}
      <div className="px-2 pb-1">
        <InlineComposer
          triggerLabel="Добавить карточку"
          placeholder="Название карточки…"
          submitLabel="Добавить"
          onSubmit={onAddCardTop}
          accent
        />
      </div>

      {/* Карточки */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto px-2 py-1',
          'transition-colors duration-200',
          isOver && 'bg-hover',
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              listId={list.id}
              users={users}
              labels={labels}
              accent={accent}
              isDone={done}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-btn border border-dashed border-line py-6 text-caption text-faint">
            <Plus size={16} strokeWidth={2} className="mb-1 opacity-60" />
            Перетащите карточку сюда
          </div>
        )}
      </div>

      {/* Добавить карточку */}
      <div className="p-2">
        <InlineComposer
          triggerLabel="Добавить карточку"
          placeholder="Название карточки…"
          submitLabel="Добавить"
          onSubmit={onAddCard}
          autoReopen
        />
      </div>
    </section>
  )
}

/** Меню колонки (⋮): переименовать, сортировка, дублировать, перенос, цвет, удалить. */
function ColumnMenu({ list, onRename, onDelete }: { list: List; onRename: () => void; onDelete: () => void }) {
  const { state, actions } = useBoard()
  const [open, setOpen] = useState(false)
  const ids = state.board.listIds
  const idx = ids.indexOf(list.id)
  const close = () => setOpen(false)

  return (
    <div className="relative shrink-0">
      <IconButton
        icon={MoreHorizontal}
        label="Действия со списком"
        size="sm"
        active={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-9 z-50 w-60 overflow-hidden rounded-modal border border-line bg-elevated py-1 shadow-md animate-scale-in"
          >
            <MItem icon={Pencil} label="Переименовать" onClick={() => { close(); onRename() }} />

            <Divider />
            <MItem icon={Flag} label="Сортировать по приоритету" onClick={() => { close(); actions.sortList(list.id, 'priority') }} />
            <MItem icon={CalendarClock} label="Сортировать по сроку" onClick={() => { close(); actions.sortList(list.id, 'due') }} />
            <MItem icon={ArrowDownAZ} label="Сортировать по названию" onClick={() => { close(); actions.sortList(list.id, 'title') }} />

            <Divider />
            <MItem icon={Copy} label="Дублировать" onClick={() => { close(); actions.duplicateList(list.id) }} />
            <MItem icon={ArrowLeft} label="Переместить влево" disabled={idx <= 0} onClick={() => { close(); actions.moveList(list.id, -1) }} />
            <MItem icon={ArrowRight} label="Переместить вправо" disabled={idx >= ids.length - 1} onClick={() => { close(); actions.moveList(list.id, 1) }} />

            <Divider />
            <div className="px-3 py-1.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">Цвет колонки</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => actions.setListColor(list.id, '')}
                  title="Авто"
                  className="flex h-5 w-5 items-center justify-center rounded-pill border border-line-strong text-faint transition-colors hover:text-fg"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => actions.setListColor(list.id, c)}
                    aria-label={`Цвет ${c}`}
                    style={{ background: c }}
                    className={cn(
                      'h-5 w-5 rounded-pill transition-transform hover:scale-110',
                      list.color === c && 'ring-2 ring-white ring-offset-2 ring-offset-elevated',
                    )}
                  />
                ))}
              </div>
            </div>

            <Divider />
            <MItem icon={Trash2} label="Удалить список" danger onClick={() => { close(); onDelete() }} />
          </div>
        </>
      )}
    </div>
  )
}

function Divider() {
  return <div className="my-1 border-t border-line" />
}

function MItem({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-small transition-colors disabled:opacity-40',
        danger ? 'text-error hover:bg-error-soft' : 'text-fg hover:bg-hover',
      )}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      {label}
    </button>
  )
}
