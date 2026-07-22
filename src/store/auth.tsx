import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { SquareKanban } from 'lucide-react'
import { getAuth, logout as apiLogout, type AuthUser } from '@/lib/api'
import { LoginScreen } from '@/components/auth/LoginScreen'

type Status = 'checking' | 'authed' | 'login'

interface AuthContextValue {
  /** Активна ли защита входом. */
  authActive: boolean
  /** Режим личных аккаунтов (регистрация по коду). */
  accountsEnabled: boolean
  /** Текущий пользователь (если вошёл по личному аккаунту). */
  user: AuthUser | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Ворота аутентификации. Спрашивает сервер, нужен ли вход, и показывает
 * экран входа/регистрации или само приложение. Если бэкенд недоступен —
 * пропускает (приложение работает локально).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking')
  const [authActive, setAuthActive] = useState(false)
  const [accountsEnabled, setAccountsEnabled] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false
    void getAuth().then((a) => {
      if (cancelled) return
      if (!a) {
        setStatus('authed') // бэкенд недоступен — не блокируем
        return
      }
      setAuthActive(a.authRequired)
      setAccountsEnabled(a.accountsEnabled)
      setUser(a.user)
      if (!a.authRequired || a.authenticated) setStatus('authed')
      else setStatus('login')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setStatus('login')
  }, [])

  if (status === 'checking') return <Splash />
  if (status === 'login') {
    return (
      <LoginScreen
        accountsEnabled={accountsEnabled}
        onSuccess={(u) => {
          setUser(u ?? null)
          setAuthActive(true)
          setStatus('authed')
        }}
      />
    )
  }

  return (
    <AuthContext.Provider value={{ authActive, accountsEnabled, user, logout }}>
      {children}
    </AuthContext.Provider>
  )
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
  if (!ctx) return { authActive: false, accountsEnabled: false, user: null, logout: async () => {} }
  return ctx
}
