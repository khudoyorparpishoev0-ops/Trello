import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BoardState, Card, Checklist, Priority } from '@/types'
import { createSeedState } from '@/data/seed'
import { loadBoard, saveBoard } from '@/lib/api'
import { uid } from '@/lib/utils'

/**
 * Store доски. Оптимистичные действия: клиент видит изменение сразу (ТЗ логики §8.1),
 * затем состояние сохраняется на сервере. Если бэкенд недоступен — работаем локально.
 */

/** Режим синхронизации с сервером. */
export type SyncMode = 'loading' | 'server' | 'local'

type Action =
  | { type: 'HYDRATE'; state: BoardState }
  | { type: 'MOVE_CARD'; cardId: string; fromListId: string; toListId: string; toIndex: number }
  | { type: 'ADD_CARD'; listId: string; title: string; atStart?: boolean }
  | { type: 'UPDATE_CARD'; cardId: string; patch: Partial<Card> }
  | { type: 'DELETE_CARD'; cardId: string }
  | { type: 'ADD_CHECKLIST'; cardId: string; title: string }
  | { type: 'ADD_CHECKLIST_ITEM'; cardId: string; checklistId: string; text: string }
  | { type: 'TOGGLE_CHECKLIST_ITEM'; cardId: string; checklistId: string; itemId: string }
  | { type: 'ADD_COMMENT'; cardId: string; text: string }
  | { type: 'ADD_LIST'; title: string }
  | { type: 'RENAME_LIST'; listId: string; title: string }
  | { type: 'DELETE_LIST'; listId: string }

function removeFrom(arr: string[], id: string): string[] {
  return arr.filter((x) => x !== id)
}

function boardReducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state

    case 'MOVE_CARD': {
      const { cardId, fromListId, toListId, toIndex } = action
      const from = state.lists[fromListId]
      const to = state.lists[toListId]
      if (!from || !to) return state

      if (fromListId === toListId) {
        const ids = removeFrom(from.cardIds, cardId)
        const clamped = Math.max(0, Math.min(toIndex, ids.length))
        ids.splice(clamped, 0, cardId)
        return { ...state, lists: { ...state.lists, [fromListId]: { ...from, cardIds: ids } } }
      }

      const fromIds = removeFrom(from.cardIds, cardId)
      const toIds = removeFrom(to.cardIds, cardId)
      const clamped = Math.max(0, Math.min(toIndex, toIds.length))
      toIds.splice(clamped, 0, cardId)
      return {
        ...state,
        lists: {
          ...state.lists,
          [fromListId]: { ...from, cardIds: fromIds },
          [toListId]: { ...to, cardIds: toIds },
        },
      }
    }

    case 'ADD_CARD': {
      const list = state.lists[action.listId]
      if (!list || !action.title.trim()) return state
      const id = uid('card')
      const card: Card = {
        id,
        title: action.title.trim(),
        labelIds: [],
        assigneeIds: [],
        priority: 'medium',
        checklists: [],
        comments: [],
        attachments: [],
        createdAt: new Date().toISOString(),
      }
      const cardIds = action.atStart
        ? [id, ...list.cardIds]
        : [...list.cardIds, id]
      return {
        ...state,
        cards: { ...state.cards, [id]: card },
        lists: { ...state.lists, [action.listId]: { ...list, cardIds } },
      }
    }

    case 'UPDATE_CARD': {
      const card = state.cards[action.cardId]
      if (!card) return state
      return { ...state, cards: { ...state.cards, [action.cardId]: { ...card, ...action.patch } } }
    }

    case 'DELETE_CARD': {
      const card = state.cards[action.cardId]
      if (!card) return state
      const nextCards = { ...state.cards }
      delete nextCards[action.cardId]
      const nextLists = { ...state.lists }
      for (const lid of Object.keys(nextLists)) {
        if (nextLists[lid].cardIds.includes(action.cardId)) {
          nextLists[lid] = { ...nextLists[lid], cardIds: removeFrom(nextLists[lid].cardIds, action.cardId) }
        }
      }
      return { ...state, cards: nextCards, lists: nextLists }
    }

    case 'ADD_CHECKLIST': {
      const card = state.cards[action.cardId]
      if (!card || !action.title.trim()) return state
      const checklist: Checklist = { id: uid('cl'), title: action.title.trim(), items: [] }
      return {
        ...state,
        cards: {
          ...state.cards,
          [action.cardId]: { ...card, checklists: [...card.checklists, checklist] },
        },
      }
    }

    case 'ADD_CHECKLIST_ITEM': {
      const card = state.cards[action.cardId]
      if (!card || !action.text.trim()) return state
      const checklists = card.checklists.map((cl) =>
        cl.id === action.checklistId
          ? { ...cl, items: [...cl.items, { id: uid('i'), text: action.text.trim(), done: false }] }
          : cl,
      )
      return { ...state, cards: { ...state.cards, [action.cardId]: { ...card, checklists } } }
    }

    case 'TOGGLE_CHECKLIST_ITEM': {
      const card = state.cards[action.cardId]
      if (!card) return state
      const checklists = card.checklists.map((cl) =>
        cl.id === action.checklistId
          ? {
              ...cl,
              items: cl.items.map((it) =>
                it.id === action.itemId ? { ...it, done: !it.done } : it,
              ),
            }
          : cl,
      )
      return { ...state, cards: { ...state.cards, [action.cardId]: { ...card, checklists } } }
    }

    case 'ADD_COMMENT': {
      const card = state.cards[action.cardId]
      if (!card || !action.text.trim()) return state
      const comment = {
        id: uid('c'),
        authorId: state.currentUserId,
        text: action.text.trim(),
        createdAt: new Date().toISOString(),
      }
      return {
        ...state,
        cards: { ...state.cards, [action.cardId]: { ...card, comments: [...card.comments, comment] } },
      }
    }

    case 'ADD_LIST': {
      if (!action.title.trim()) return state
      const id = uid('list')
      return {
        ...state,
        lists: { ...state.lists, [id]: { id, title: action.title.trim(), cardIds: [] } },
        board: { ...state.board, listIds: [...state.board.listIds, id] },
      }
    }

    case 'RENAME_LIST': {
      const list = state.lists[action.listId]
      if (!list || !action.title.trim()) return state
      return {
        ...state,
        lists: { ...state.lists, [action.listId]: { ...list, title: action.title.trim() } },
      }
    }

    case 'DELETE_LIST': {
      const list = state.lists[action.listId]
      if (!list) return state
      const nextLists = { ...state.lists }
      delete nextLists[action.listId]
      const nextCards = { ...state.cards }
      for (const cid of list.cardIds) delete nextCards[cid]
      return {
        ...state,
        lists: nextLists,
        cards: nextCards,
        board: { ...state.board, listIds: removeFrom(state.board.listIds, action.listId) },
      }
    }

    default:
      return state
  }
}

export interface BoardActions {
  moveCard: (cardId: string, fromListId: string, toListId: string, toIndex: number) => void
  addCard: (listId: string, title: string, atStart?: boolean) => void
  updateCard: (cardId: string, patch: Partial<Card>) => void
  deleteCard: (cardId: string) => void
  addChecklist: (cardId: string, title: string) => void
  addChecklistItem: (cardId: string, checklistId: string, text: string) => void
  toggleChecklistItem: (cardId: string, checklistId: string, itemId: string) => void
  addComment: (cardId: string, text: string) => void
  setPriority: (cardId: string, priority: Priority) => void
  addList: (title: string) => void
  renameList: (listId: string, title: string) => void
  deleteList: (listId: string) => void
}

interface BoardContextValue {
  state: BoardState
  actions: BoardActions
  /** Синхронизируется ли доска с сервером. */
  mode: SyncMode
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(boardReducer, undefined, createSeedState)
  const [mode, setMode] = useState<SyncMode>('loading')
  const loadedRef = useRef(false)

  // Загрузка доски с сервера при старте. Нет данных/бэкенда — работаем локально.
  useEffect(() => {
    let cancelled = false
    void loadBoard().then(async (data) => {
      if (cancelled) return
      if (data) {
        dispatch({ type: 'HYDRATE', state: data })
        setMode('server')
      } else {
        // Сервер пуст или недоступен — пробуем записать текущее (сид) состояние.
        const ok = await saveBoard(state)
        setMode(ok ? 'server' : 'local')
      }
      loadedRef.current = true
    })
    return () => {
      cancelled = true
    }
    // Только при монтировании: state здесь — начальный сид.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Сохранение изменений на сервер (с debounce), после первичной загрузки.
  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(() => {
      void saveBoard(state).then((ok) => setMode(ok ? 'server' : 'local'))
    }, 700)
    return () => clearTimeout(t)
  }, [state])

  const actions = useMemo<BoardActions>(
    () => ({
      moveCard: (cardId, fromListId, toListId, toIndex) =>
        dispatch({ type: 'MOVE_CARD', cardId, fromListId, toListId, toIndex }),
      addCard: (listId, title, atStart) => dispatch({ type: 'ADD_CARD', listId, title, atStart }),
      updateCard: (cardId, patch) => dispatch({ type: 'UPDATE_CARD', cardId, patch }),
      deleteCard: (cardId) => dispatch({ type: 'DELETE_CARD', cardId }),
      addChecklist: (cardId, title) => dispatch({ type: 'ADD_CHECKLIST', cardId, title }),
      addChecklistItem: (cardId, checklistId, text) =>
        dispatch({ type: 'ADD_CHECKLIST_ITEM', cardId, checklistId, text }),
      toggleChecklistItem: (cardId, checklistId, itemId) =>
        dispatch({ type: 'TOGGLE_CHECKLIST_ITEM', cardId, checklistId, itemId }),
      addComment: (cardId, text) => dispatch({ type: 'ADD_COMMENT', cardId, text }),
      setPriority: (cardId, priority) => dispatch({ type: 'UPDATE_CARD', cardId, patch: { priority } }),
      addList: (title) => dispatch({ type: 'ADD_LIST', title }),
      renameList: (listId, title) => dispatch({ type: 'RENAME_LIST', listId, title }),
      deleteList: (listId) => dispatch({ type: 'DELETE_LIST', listId }),
    }),
    [],
  )

  const value = useMemo(() => ({ state, actions, mode }), [state, actions, mode])
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard must be used within BoardProvider')
  return ctx
}
