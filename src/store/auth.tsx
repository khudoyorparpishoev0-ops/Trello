import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { SquareKanban } from 'lucide-react'
import { getAuth, logout as apiLogout } from '@/lib/api'
import { LoginScreen } from '@/components/auth/LoginScreen'

type Status = 'checking' | 'authed' | 'login'

interface AuthContextValue {
  /** Активна ли защита входом (задан пароль на сервере). */
  authActive: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Ворота аутентификации. Спрашивает сервер, нужен ли вход:
 * - вход не требуется / уже выполнен → показываем приложение;
 * - требуется и не выполнен → показываем экран входа;
 * - бэкенд недоступен → пропускаем (приложение работает локально).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [authActive, setAuthActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getAuth().then((a) => {
      if (cancelled) return
      if (!a) {
        // Бэкенд недоступен — не блокируем, работаем как раньше.
        setAuthActive(false)
        setStatus('authed')
      } else if (!a.authRequired) {
        setAuthActive(false)
        setStatus('authed')
      } else if (a.authenticated) {
        setAuthActive(true)
        setStatus('authed')
      } else {
        setAuthActive(true)
        setStatus('login')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setStatus('login')
  }, [])

  if (status === 'checking') return <Splash />
  if (status === 'login') {
    return (
      <LoginScreen
        onSuccess={() => {
          setAuthActive(true)
          setStatus('authed')
        }}
      />
    )
  }

  return <AuthContext.Provider value={{ authActive, logout }}>{children}</AuthContext.Provider>
}

function Splash() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg">
      <div className="flex items-center gap-3 text-muted">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand">
          <SquareKanban size={20} strokeWidth={2.5} className="text-white" />
        </span>
        <span className="animate-pulse text-small">Загрузка…</span>
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) return { authActive: false, logout: async () => {} }
  return ctx
}
