/**
 * Адресация разделов (R-04).
 *
 * Полноценный роутер сюда не тянется: экранов семь, параметров два, а
 * `react-router` — новая зависимость и перестройка навигации во всех разделах.
 * Здесь чистые функции разбора и сборки адреса; состояние и History API —
 * в `store/router.tsx`.
 *
 * Схема адресов:
 *   /dashboard · /team · /calendar · /company · /reports · /settings
 *   /board/<boardId>            — канбан
 *   /board/<boardId>/timeline   — таймлайн
 *   /board/<boardId>/table      — таблица
 *   ?card=<cardId>              — панель задачи поверх любого раздела
 *
 * Карточка вынесена в параметр запроса намеренно: панель — накладка, она
 * открывается и с дашборда, и из календаря, и из отчётов, где сегмента доски
 * в адресе нет.
 */

export type AppView = 'board' | 'dashboard' | 'company' | 'calendar' | 'team' | 'reports' | 'profile'
export type BoardViewKind = 'board' | 'timeline' | 'table'

export interface Route {
  view: AppView
  /** Доска в адресе. null — какая именно, решится после загрузки данных. */
  boardId: string | null
  boardView: BoardViewKind
  /** Открытая карточка. */
  cardId: string | null
}

/** Первый сегмент пути ↔ раздел. Раздел профиля адресуется понятным «settings». */
const SEGMENT_TO_VIEW: Record<string, AppView> = {
  dashboard: 'dashboard',
  board: 'board',
  team: 'team',
  calendar: 'calendar',
  company: 'company',
  reports: 'reports',
  settings: 'profile',
}
const VIEW_TO_SEGMENT: Record<AppView, string> = {
  dashboard: 'dashboard',
  board: 'board',
  team: 'team',
  calendar: 'calendar',
  company: 'company',
  reports: 'reports',
  profile: 'settings',
}

const BOARD_VIEWS: BoardViewKind[] = ['board', 'timeline', 'table']

export const DEFAULT_ROUTE: Route = { view: 'board', boardId: null, boardView: 'board', cardId: null }

/**
 * Разобрать адрес. Неизвестный путь — это доска: приложение открывается на ней,
 * и «страницы 404» в системе нет.
 */
export function parseRoute(pathname: string, search = ''): Route {
  const params = new URLSearchParams(search)
  const cardId = params.get('card') || null
  const segments = pathname.split('/').filter(Boolean)
  const view = SEGMENT_TO_VIEW[segments[0] ?? ''] ?? 'board'

  if (view !== 'board') return { view, boardId: null, boardView: 'board', cardId }

  // Прежние ссылки вида /?board=<id> продолжают работать: их уже разослали.
  const legacyBoard = segments.length === 0 ? params.get('board') : null
  const boardId = segments[1] || legacyBoard || null
  const tail = segments[2] as BoardViewKind | undefined
  const boardView = tail && BOARD_VIEWS.includes(tail) ? tail : 'board'
  return { view: 'board', boardId, boardView, cardId }
}

/** Собрать адрес обратно. Возвращает путь вместе с параметрами запроса. */
export function buildPath(route: Route): string {
  const segment = VIEW_TO_SEGMENT[route.view]
  let path = `/${segment}`
  if (route.view === 'board') {
    // Без известной доски остаётся короткий /board: подставить нечего.
    if (route.boardId) path += `/${encodeURIComponent(route.boardId)}`
    if (route.boardView !== 'board' && route.boardId) path += `/${route.boardView}`
  }
  return route.cardId ? `${path}?card=${encodeURIComponent(route.cardId)}` : path
}
