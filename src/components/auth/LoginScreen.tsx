import { useState, type FormEvent } from 'react'
import { SquareKanban, Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { login as apiLogin } from '@/lib/api'

/** Экран входа (Brand Book: Ink-фон, карточка, Inter, зелёная кнопка). */
export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!loginName.trim() || !password) return
    setLoading(true)
    setError(false)
    const ok = await apiLogin(loginName.trim(), password)
    setLoading(false)
    if (ok) onSuccess()
    else setError(true)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px]">
        {/* Логотип */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand">
            <SquareKanban size={26} strokeWidth={2.5} className="text-white" />
          </span>
          <div className="text-center leading-tight">
            <div className="text-h3 font-bold tracking-tight text-fg">IT-HONA</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">
              TaskBoard
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-card border border-line bg-surface p-6 shadow-md sm:p-8"
        >
          <h1 className="mb-1 text-h3 font-semibold text-fg">Вход</h1>
          <p className="mb-6 text-caption text-muted">Доступ только для команды</p>

          <label className="mb-1.5 block text-caption font-medium text-muted">Логин</label>
          <div className="relative mb-4">
            <User
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
              autoFocus
              className="h-11 w-full rounded-input border border-line bg-bg pl-9 pr-3 text-small text-fg outline-none transition-colors focus:border-brand placeholder:text-faint"
              placeholder="admin"
            />
          </div>

          <label className="mb-1.5 block text-caption font-medium text-muted">Пароль</label>
          <div className="relative mb-2">
            <Lock
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 w-full rounded-input border border-line bg-bg pl-9 pr-3 text-small text-fg outline-none transition-colors focus:border-brand placeholder:text-faint"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="mb-3 text-caption text-error">Неверный логин или пароль</p>
          )}

          <Button type="submit" className="mt-4 w-full" loading={loading} disabled={loading}>
            Войти
          </Button>
        </form>

        <p className="mt-6 text-center text-caption text-faint">IT-HONA · Платформа управления задачами</p>
      </div>
    </div>
  )
}
