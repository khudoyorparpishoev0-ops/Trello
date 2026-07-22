import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MoreHorizontal, Trash2, Plus } from 'lucide-react'
import type { Card, Label, List, User } from '@/types'
import { KanbanCard } from './KanbanCard'
import { InlineComposer } from './InlineComposer'
import { IconButton } from '@/components/ui/IconButton'
import { Menu } from '@/components/ui/Menu'
import { isDoneList, listAccentColor } from '@/lib/design'
import { cn } from '@/lib/utils'

interface ColumnProps {
  list: List
  cards: Card[]
  users: Record<string, User>
  labels: Record<string, Label>
  onAddCard: (title: string) => void
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
  onRename,
  onDelete,
  onOpenCard,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id, data: { type: 'list' } })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)

  const accent = listAccentColor(list.title)
  const done = isDoneList(list.title)
  const overLimit = list.wipLimit !== undefined && cards.length > list.wipLimit
  const atLimit = list.wipLimit !== undefined && cards.length >= list.wipLimit

  const commitRename = () => {
    const v = title.trim()
    if (v && v !== list.title) onRename(v)
    else setTitle(list.title)
    setEditing(false)
  }

  return (
    <section className="flex h-full w-[86vw] max-w-[320px] shrink-0 flex-col rounded-card bg-surface-2 sm:w-[300px]">
      {/* Шапка колонки */}
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
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
            onDoubleClick={() => {
              setTitle(list.title)
              setEditing(true)
            }}
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
        <Menu
          align="right"
          trigger={({ toggle, open }) => (
            <IconButton
              icon={MoreHorizontal}
              label="Действия со списком"
              size="sm"
              active={open}
              onClick={toggle}
            />
          )}
          items={[{ label: 'Удалить список', icon: Trash2, danger: true, onClick: onDelete }]}
        />
      </header>

      {atLimit && (
        <p className={cn('px-3 pb-1 text-[11px]', overLimit ? 'text-error' : 'text-warning')}>
          {overLimit ? 'Превышен WIP-лимит' : 'Достигнут WIP-лимит'}
        </p>
      )}

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
