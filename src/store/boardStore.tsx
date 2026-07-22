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
import type { AppData, Board, BoardState, Card, Checklist, List, Priority } from '@/types'
import { createSeedState, emptyBoard, DEFAULT_DEPARTMENTS } from '@/data/seed'
import { loadBoard, saveBoard } from '@/lib/api'
import { uid } from '@/lib/utils'

/**
 * Store приложения. Хранит несколько досок (AppData); компонентам отдаёт
 * представление активной доски (BoardState). Действия оптимистичны, затем
 * состояние сохраняется на сервере; при недоступности — работаем локально.
 */

export type SyncMode = 'loading' | 'server' | 'local'

type Action =
  | { type: 'HYDRATE'; data: AppData }
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
  | { type: 'SWITCH_BOARD'; boardId: string }
  | { type: 'ADD_BOARD'; name: string }
  | { type: 'RENAME_BOARD'; boardId: string; name: string }
  | { type: 'DELETE_BOARD'; boardId: string }
  | { type: 'ADD_DEPARTMENT'; name: string }
  | { type: 'REMOVE_DEPARTMENT'; name: string }

function removeFrom(arr: string[], id: string): string[] {
  return arr.filter((x) => x !== id)
}

function appReducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'HYDRATE':
      return action.data

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
      const cardIds = action.atStart ? [id, ...list.cardIds] : [...list.cardIds, id]
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
        cards: { ...state.cards, [action.cardId]: { ...card, checklists: [...card.checklists, checklist] } },
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
          ? { ...cl, items: cl.items.map((it) => (it.id === action.itemId ? { ...it, done: !it.done } : it)) }
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
      const board = state.boards[state.activeBoardId]
      if (!board) return state
      const id = uid('list')
      return {
        ...state,
        lists: { ...state.lists, [id]: { id, title: action.title.trim(), cardIds: [] } },
        boards: { ...state.boards, [board.id]: { ...board, listIds: [...board.listIds, id] } },
      }
    }

    case 'RENAME_LIST': {
      const list = state.lists[action.listId]
      if (!list || !action.title.trim()) return state
      return { ...state, lists: { ...state.lists, [action.listId]: { ...list, title: action.title.trim() } } }
    }

    case 'DELETE_LIST': {
      const list = state.lists[action.listId]
      if (!list) return state
      const nextLists = { ...state.lists }
      delete nextLists[action.listId]
      const nextCards = { ...state.cards }
      for (const cid of list.cardIds) delete nextCards[cid]
      const nextBoards = { ...state.boards }
      for (const bid of Object.keys(nextBoards)) {
        if (nextBoards[bid].listIds.includes(action.listId)) {
          nextBoards[bid] = { ...nextBoards[bid], listIds: removeFrom(nextBoards[bid].listIds, action.listId) }
        }
      }
      return { ...state, lists: nextLists, cards: nextCards, boards: nextBoards }
    }

    case 'SWITCH_BOARD':
      return state.boards[action.boardId] ? { ...state, activeBoardId: action.boardId } : state

    case 'ADD_BOARD': {
      if (!action.name.trim()) return state
      const id = uid('board')
      const memberIds = state.boards[state.activeBoardId]?.memberIds ?? Object.keys(state.users)
      const { board, lists } = emptyBoard(id, action.name.trim(), memberIds)
      return {
        ...state,
        boards: { ...state.boards, [id]: board },
        boardOrder: [...state.boardOrder, id],
        lists: { ...state.lists, ...lists },
        activeBoardId: id,
      }
    }

    case 'RENAME_BOARD': {
      const b = state.boards[action.boardId]
      if (!b || !action.name.trim()) return state
      return { ...state, boards: { ...state.boards, [action.boardId]: { ...b, name: action.name.trim() } } }
    }

    case 'DELETE_BOARD': {
      if (state.boardOrder.length <= 1) return state
      const b = state.boards[action.boardId]
      if (!b) return state
      const nextBoards = { ...state.boards }
      delete nextBoards[action.boardId]
      const nextLists = { ...state.lists }
      const nextCards = { ...state.cards }
      for (const lid of b.listIds) {
        const l = state.lists[lid]
        if (l) for (const cid of l.cardIds) delete nextCards[cid]
        delete nextLists[lid]
      }
      const order = removeFrom(state.boardOrder, action.boardId)
      const active = state.activeBoardId === action.boardId ? order[0] : state.activeBoardId
      return { ...state, boards: nextBoards, lists: nextLists, cards: nextCards, boardOrder: order, activeBoardId: active }
    }

    case 'ADD_DEPARTMENT': {
      const n = action.name.trim()
      if (!n || state.departments.includes(n)) return state
      return { ...state, departments: [...state.departments, n] }
    }

    case 'REMOVE_DEPARTMENT':
      return { ...state, departments: state.departments.filter((d) => d !== action.name) }

    default:
      return state
  }
}

// ——— Миграция и представление ———
function isAppData(x: unknown): x is AppData {
  return !!x && typeof x === 'object' && 'boards' in x && 'activeBoardId' in x
}

/** Старый формат (одна доска) → новый (несколько досок). */
function migrate(raw: unknown): AppData {
  if (isAppData(raw)) {
    return { ...raw, departments: raw.departments?.length ? raw.departments : [...DEFAULT_DEPARTMENTS] }
  }
  const old = raw as BoardState
  const memberIds = old.board?.memberIds ?? Object.keys(old.users ?? {})
  const boards: Record<string, Board> = {}
  const order: string[] = []
  const extraLists: Record<string, List> = {}
  if (old.board) {
    boards[old.board.id] = old.board
    order.push(old.board.id)
  }
  for (const wb of old.workspace?.boards ?? []) {
    if (boards[wb.id]) continue
    const { board, lists } = emptyBoard(wb.id, wb.name, memberIds)
    boards[wb.id] = board
    order.push(wb.id)
    Object.assign(extraLists, lists)
  }
  return {
    workspace: old.workspace ?? { id: 'ws_ithona', name: 'IT-HONA', boards: [] },
    users: old.users ?? {},
    currentUserId: old.currentUserId ?? Object.keys(old.users ?? {})[0] ?? '',
    boards,
    boardOrder: order.length ? order : Object.keys(boards),
    activeBoardId: old.board?.id ?? order[0] ?? '',
    lists: { ...(old.lists ?? {}), ...extraLists },
    cards: old.cards ?? {},
    labels: old.labels ?? {},
    departments: [...DEFAULT_DEPARTMENTS],
  }
}

/** AppData → представление активной доски. */
function deriveView(app: AppData): BoardState {
  const board = app.boards[app.activeBoardId] ?? app.boards[app.boardOrder[0]]
  const lists: Record<string, List> = {}
  const cards: Record<string, Card> = {}
  if (board) {
    for (const lid of board.listIds) {
      const l = app.lists[lid]
      if (!l) continue
      lists[lid] = l
      for (const cid of l.cardIds) {
        const c = app.cards[cid]
        if (c) cards[cid] = c
      }
    }
  }
  return { board, lists, cards, labels: app.labels, users: app.users, workspace: app.workspace, currentUserId: app.currentUserId }
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
  switchBoard: (boardId: string) => void
  addBoard: (name: string) => void
  renameBoard: (boardId: string, name: string) => void
  deleteBoard: (boardId: string) => void
  addDepartment: (name: string) => void
  removeDepartment: (name: string) => void
}

interface BoardContextValue {
  state: BoardState
  actions: BoardActions
  mode: SyncMode
  /** Доски пространства (для сайдбара и «Проектов»). */
  boards: { id: string; name: string; memberIds: string[] }[]
  activeBoardId: string
  /** Отделы компании. */
  departments: string[]
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [app, dispatch] = useReducer(appReducer, undefined, createSeedState)
  const [mode, setMode] = useState<SyncMode>('loading')
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadBoard().then(async (data) => {
      if (cancelled) return
      if (data) {
        dispatch({ type: 'HYDRATE', data: migrate(data) })
        setMode('server')
      } else {
        const ok = await saveBoard(app)
        setMode(ok ? 'server' : 'local')
      }
      loadedRef.current = true
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(() => {
      void saveBoard(app).then((ok) => setMode(ok ? 'server' : 'local'))
    }, 700)
    return () => clearTimeout(t)
  }, [app])

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
      switchBoard: (boardId) => dispatch({ type: 'SWITCH_BOARD', boardId }),
      addBoard: (name) => dispatch({ type: 'ADD_BOARD', name }),
      renameBoard: (boardId, name) => dispatch({ type: 'RENAME_BOARD', boardId, name }),
      deleteBoard: (boardId) => dispatch({ type: 'DELETE_BOARD', boardId }),
      addDepartment: (name) => dispatch({ type: 'ADD_DEPARTMENT', name }),
      removeDepartment: (name) => dispatch({ type: 'REMOVE_DEPARTMENT', name }),
    }),
    [],
  )

  const state = useMemo(() => deriveView(app), [app])
  const boards = useMemo(
    () =>
      app.boardOrder
        .filter((id) => app.boards[id])
        .map((id) => ({ id, name: app.boards[id].name, memberIds: app.boards[id].memberIds })),
    [app.boardOrder, app.boards],
  )

  const value = useMemo(
    () => ({ state, actions, mode, boards, activeBoardId: app.activeBoardId, departments: app.departments }),
    [state, actions, mode, boards, app.activeBoardId, app.departments],
  )
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard must be used within BoardProvider')
  return ctx
}
