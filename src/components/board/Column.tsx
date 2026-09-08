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
  CheckCircle2,
  Circle,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Card, Label, List, User } from '@/types'
import { KanbanCard } from './KanbanCard'
import { InlineComposer } from './InlineComposer'
import { IconButton } from '@/components/ui/IconButton'
import { useBoard } from '@/store/boardStore'
import { isListDone, listAccentColor } from '@/lib/design'
import { cn } from '@/lib/utils'

/**
 * Цвета точки-индикатора колонки: зелёная шкала брендбука плюс четыре
 * статусных тона. Произвольных оттенков в палитре нет.
 */
const COLUMN_COLORS = [
  '#0E3B21', '#186B36', '#22A74E', '#7FBF95',
  '#2E6FD9', '#E0A126', '#B8382C', '#9AA39C',
]

interface ColumnProps {
  list: List
  cards: Card[]
  users: Record<string, User>
  labels: Record<string, Label>
  /** Добавить карточку в начало списка (кнопка вверху колонки). */
  onAddCardTop: (title: string) => void
  onRename: (title: string) => void
  onDelete: () => void
  onOpenCard: (cardId: string) => void
  /** Одна колонка во всю ширину — раскладка доски на телефоне. */
  fullWidth?: boolean
}

/** Список / колонка-стадия (ТЗ логики §4.2). Droppable-контейнер для карточек. */
export function Column({
  list,
  cards,
  users,
  labels,
  onAddCardTop,
  onRename,
  onDelete,
  onOpenCard,
  fullWidth,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: 'list' } })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)

  const accent = list.color || listAccentColor(list.title)
  const done = isListDone(list)
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
    <section
      className={cn(
        'flex h-full flex-col',
        fullWidth ? 'w-full' : 'w-[86vw] max-w-[320px] shrink-0 sm:w-[300px]',
      )}
    >
      {/* Шапка колонки */}
      <header className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0" style={{ background: accent }} aria-hidden />
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
            className="min-w-0 flex-1 rounded-chip border border-brand bg-surface px-2 py-1 text-h3 text-fg outline-none"
          />
        ) : (
          <h3
            className="min-w-0 flex-1 cursor-text truncate text-h3"
            onDoubleClick={startRename}
            title="Двойной клик — переименовать"
          >
            {list.title}
          </h3>
        )}
        <span
          className={cn('mono-data shrink-0 px-1', overLimit ? 'bg-err-bg text-err-ink' : 'text-muted')}
          title={list.wipLimit !== undefined ? `WIP-лимит: ${list.wipLimit}` : undefined}
        >
          {cards.length}
          {list.wipLimit !== undefined && `/${list.wipLimit}`}
        </span>
        <ColumnMenu list={list} onRename={startRename} onDelete={onDelete} />
      </header>

      {atLimit && (
        <div
          className={cn(
            'mb-3 border-l-2 p-2',
            overLimit ? 'border-l-err bg-err-bg' : 'border-l-warn bg-warn-bg',
          )}
        >
          <span className={cn('mono-label', overLimit ? 'text-err-ink' : 'text-warn-ink')}>
            {overLimit ? 'Превышен WIP-лимит' : 'Достигнут WIP-лимит'}
          </span>
          <span className="mt-1 block text-caption text-muted">
            Лимит предупреждает, добавление не блокируется.
          </span>
        </div>
      )}

      {/* Добавить карточку — вверху колонки (вставка в начало) */}
      <div className="mb-2">
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
          'flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto pb-2',
          'transition-colors',
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
          <div className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line px-3 py-6 text-center">
            <Plus size={18} strokeWidth={1.6} className="text-faint" />
            <span className="text-caption text-muted">Пока пусто</span>
            <span className="text-caption text-faint">Перетащите карточку сюда или добавьте новую</span>
          </div>
        )}
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
            className="absolute right-0 top-9 z-50 w-64 overflow-hidden rounded-card border border-line bg-elevated py-1 shadow-md animate-scale-in"
          >
            <MItem icon={Pencil} label="Переименовать" onClick={() => { close(); onRename() }} />

            <Divider />
            <MItem icon={Flag} label="Сортировать по приоритету" onClick={() => { close(); actions.sortList(list.id, 'priority') }} />
            <MItem icon={CalendarClock} label="Сортировать по сроку" onClick={() => { close(); actions.sortList(list.id, 'due') }} />
            <MItem icon={ArrowDownAZ} label="Сортировать по названию" onClick={() => { close(); actions.sortList(list.id, 'title') }} />

            <Divider />
            {/* Системный статус: не зависит от названия списка (его можно переименовать). */}
            <MItem
              icon={isListDone(list) ? CheckCircle2 : Circle}
              label={isListDone(list) ? 'Задачи выполнены ✓' : 'Считать задачи выполненными'}
              onClick={() => { close(); actions.setListDone(list.id, !isListDone(list)) }}
            />

            <Divider />
            <MItem icon={Copy} label="Дублировать" onClick={() => { close(); actions.duplicateList(list.id) }} />
            <MItem icon={ArrowLeft} label="Переместить влево" disabled={idx <= 0} onClick={() => { close(); actions.moveList(list.id, -1) }} />
            <MItem icon={ArrowRight} label="Переместить вправо" disabled={idx >= ids.length - 1} onClick={() => { close(); actions.moveList(list.id, 1) }} />

            <Divider />
            <div className="px-3 py-1.5">
              <div className="mono-label mb-2 text-faint">Цвет колонки</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => actions.setListColor(list.id, '')}
                  title="Авто"
                  className="flex h-6 w-6 items-center justify-center rounded-chip border border-line-strong text-faint transition-colors hover:text-fg"
                >
                  <X size={12} strokeWidth={1.6} />
                </button>
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => actions.setListColor(list.id, c)}
                    aria-label={`Цвет ${c}`}
                    style={{ background: c }}
                    className={cn(
                      'h-6 w-6 rounded-chip transition-transform hover:scale-105',
                      list.color === c && 'ring-2 ring-brand ring-offset-2 ring-offset-elevated',
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
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-small transition-colors disabled:opacity-40',
        danger ? 'text-err-ink hover:bg-err-bg' : 'text-fg hover:bg-hover',
      )}
    >
      <Icon size={16} strokeWidth={1.6} className="shrink-0" />
      {label}
    </button>
  )
}
