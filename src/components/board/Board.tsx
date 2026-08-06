import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Column } from './Column'
import { InlineComposer } from './InlineComposer'
import { KanbanCardView } from './KanbanCard'
import { useBoard } from '@/store/boardStore'
import { isDoneList, listAccentColor } from '@/lib/design'
import { cardMatchesFilters } from '@/lib/filterCards'
import { boardBgStyle } from '@/lib/backgrounds'
import type { Card } from '@/types'

export interface Filters {
  query: string
  onlyMine: boolean
  overdue: boolean
}

interface BoardProps {
  filters: Filters
  onOpenCard: (cardId: string) => void
}

export function Board({ filters, onOpenCard }: BoardProps) {
  const { state, actions } = useBoard()
  const { board, lists, cards, users, labels } = state
  const [activeId, setActiveId] = useState<string | null>(null)

  // Мышь — тянем сразу (порог 6px, чтобы клик открывал карточку).
  // Тач — тянем после долгого нажатия (250ms), чтобы обычный свайп прокручивал колонку.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findListId = (id: string): string | undefined => {
    if (lists[id]) return id
    return board.listIds.find((lid) => lists[lid].cardIds.includes(id))
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeCardId = String(active.id)
    const overId = String(over.id)
    const fromList = findListId(activeCardId)
    const toList = findListId(overId)
    if (!fromList || !toList || fromList === toList) return

    let newIndex: number
    if (lists[overId]) {
      newIndex = lists[toList].cardIds.length
    } else {
      const overIndex = lists[toList].cardIds.indexOf(overId)
      const translated = active.rect.current.translated
      const isBelow =
        translated && over.rect ? translated.top > over.rect.top + over.rect.height / 2 : false
      newIndex = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : lists[toList].cardIds.length
    }
    actions.moveCard(activeCardId, fromList, toList, newIndex)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const activeCardId = String(active.id)
    const overId = String(over.id)
    const fromList = findListId(activeCardId)
    const toList = findListId(overId)
    if (!fromList || !toList) return

    const ids = lists[toList].cardIds
    const oldIndex = ids.indexOf(activeCardId)
    const newIndex = lists[overId] ? ids.length - 1 : ids.indexOf(overId)
    if (fromList === toList && oldIndex !== newIndex && newIndex >= 0) {
      actions.moveCard(activeCardId, fromList, toList, newIndex)
    }
  }

  const activeCard = activeId ? cards[activeId] : null
  const activeListId = activeId ? findListId(activeId) : undefined
  const activeList = activeListId ? lists[activeListId] : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="relative h-full" style={boardBgStyle(board.background)}>
      <div className="flex h-full items-start gap-3 overflow-x-auto px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
        {board.listIds.map((listId) => {
          const list = lists[listId]
          if (!list) return null
          const visible = list.cardIds
            .map((id) => cards[id])
            .filter((c): c is Card => Boolean(c) && cardMatchesFilters(c, list, state, filters))
          return (
            <Column
              key={list.id}
              list={list}
              cards={visible}
              users={users}
              labels={labels}
              onAddCardTop={(title) => actions.addCard(list.id, title, true)}
              onRename={(title) => actions.renameList(list.id, title)}
              onDelete={() => actions.deleteList(list.id)}
              onOpenCard={onOpenCard}
            />
          )
        })}

        {/* Добавить список */}
        <div className="w-[86vw] max-w-[320px] shrink-0 sm:w-[300px]">
          <InlineComposer
            triggerLabel="Добавить список"
            placeholder="Название списка…"
            submitLabel="Добавить список"
            onSubmit={(title) => actions.addList(title)}
            variant="dashed"
          />
        </div>
      </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.4,0,0.2,1)' }}>
        {activeCard && activeList ? (
          <KanbanCardView
            card={activeCard}
            users={users}
            labels={labels}
            accent={listAccentColor(activeList.title)}
            isDone={isDoneList(activeList.title)}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
