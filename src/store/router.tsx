import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildPath, parseRoute, type Route } from '@/lib/route'

interface RouterValue {
  route: Route
  /**
   * Перейти, изменив часть адреса. `replace` — не добавлять запись в историю
   * (например, при подстановке доски по умолчанию: возвращаться туда некуда).
   */
  navigate: (patch: Partial<Route>, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterValue | null>(null)

const currentUrl = () => window.location.pathname + window.location.search

/**
 * Адресация без сторонней библиотеки: History API плюс `popstate`.
 *
 * До этого раздел жил в состоянии React — нельзя было дать ссылку на задачу
 * или раздел, «назад» выходила из приложения, а перезагрузка возвращала на
 * доску. Роутер целиком ради семи экранов и двух параметров — лишняя
 * зависимость и перестройка навигации во всех разделах.
 */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname, window.location.search))
  // Актуальный адрес для navigate: считать патч внутри setState нельзя —
  // в StrictMode обновляющая функция вызывается дважды и запись в историю
  // задвоилась бы.
  const routeRef = useRef(route)
  routeRef.current = route

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname, window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Приводим адрес к канонному виду: «/» и прежняя ссылка «/?board=<id>»
  // должны стать «/board/<id>» — но без записи в историю.
  useEffect(() => {
    const canonical = buildPath(routeRef.current)
    if (canonical !== currentUrl() && routeRef.current.boardId) {
      window.history.replaceState(null, '', canonical)
    }
  }, [])

  const navigate = useCallback<RouterValue['navigate']>((patch, options) => {
    const next = { ...routeRef.current, ...patch }
    const url = buildPath(next)
    if (url !== currentUrl()) {
      if (options?.replace) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    }
    routeRef.current = next
    setRoute(next)
  }, [])

  return <RouterContext.Provider value={{ route, navigate }}>{children}</RouterContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}
