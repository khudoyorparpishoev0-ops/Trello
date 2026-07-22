import { useState, type FormEvent, type ReactNode } from 'react'
import { SquareKanban, Lock, User, IdCard, KeyRound, Building2, Cake, Briefcase, Mail } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { login as apiLogin, register as apiRegister, type AuthUser } from '@/lib/api'
import { loginFromName } from '@/lib/translit'
import { cn } from '@/lib/utils'

interface LoginScreenProps {
  accountsEnabled: boolean
  onSuccess: (user?: AuthUser) => void
}

const ERRORS: Record<string, string> = {
  invalid_credentials: 'Неверный логин или пароль',
  bad_code: 'Неверный код приглашения',
  login_taken: 'Такой логин уже занят',
  invalid_fields: 'Проверьте поля: имя, логин от 3 символов, пароль от 6',
  network: 'Нет связи с сервером',
}

/** Экран входа / регистрации (Brand Book). Регистрация — при включённых аккаунтах. */
export function LoginScreen({ accountsEnabled, onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [department, setDepartment] = useState('')
  const [birthday, setBirthday] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Логин авто-создаётся из ФИО, пока пользователь не изменит его вручную.
  const [loginEdited, setLoginEdited] = useState(false)

  const onNameChange = (value: string) => {
    setName(value)
    if (mode === 'register' && !loginEdited) setLoginName(loginFromName(value))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'login') {
      if (!loginName.trim() || !password) return
      setLoading(true)
      const r = await apiLogin(loginName.trim(), password)
      setLoading(false)
      if (r.ok) onSuccess(r.user)
      else setError(ERRORS[r.error ?? ''] ?? 'Не удалось войти')
    } else {
      if (
        !name.trim() ||
        !loginName.trim() ||
        !password ||
        !code.trim() ||
        !department.trim() ||
        !birthday ||
        !email.trim() ||
        !position.trim()
      )
        return
      setLoading(true)
      const r = await apiRegister({
        name: name.trim(),
        login: loginName.trim(),
        password,
        code: code.trim(),
        department: department.trim(),
        birthday,
        email: email.trim(),
        position: position.trim(),
      })
      setLoading(false)
      if (r.ok) onSuccess(r.user)
      else setError(ERRORS[r.error ?? ''] ?? 'Не удалось зарегистрироваться')
    }
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    if (m === 'register') setLoginEdited(false)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand">
            <SquareKanban size={26} strokeWidth={2.5} className="text-white" />
          </span>
          <div className="text-center leading-tight">
            <div className="text-h3 font-bold tracking-tight text-fg">IT-HONA</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">TaskBoard</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-card border border-line bg-surface p-6 shadow-md sm:p-8">
          {accountsEnabled ? (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-btn bg-surface-2 p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    'rounded-[10px] py-1.5 text-caption font-medium transition-colors duration-200',
                    mode === m ? 'bg-bg text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {m === 'login' ? 'Вход' : 'Регистрация'}
                </button>
              ))}
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-h3 font-semibold text-fg">Вход</h1>
              <p className="mb-6 text-caption text-muted">Доступ только для команды</p>
            </>
          )}

          {mode === 'register' && (
            <>
              <Field icon={IdCard} label="Ф.И.О">
                <input
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  autoFocus
                  placeholder="Иванов Иван Иванович"
                  className={inputCls}
                />
              </Field>
              <Field icon={Briefcase} label="Должность">
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Руководитель отдела"
                  className={inputCls}
                />
              </Field>
              <Field icon={Building2} label="Отдел">
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Разработка"
                  className={inputCls}
                />
              </Field>
              <Field icon={Mail} label="E-mail">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="ivan@ithona.tj"
                  className={inputCls}
                />
              </Field>
              <Field icon={Cake} label="Дата рождения">
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={cn(inputCls, '[color-scheme:dark]')}
                />
              </Field>
            </>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-caption font-medium text-muted">Логин</label>
            <div className="relative">
              <User
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={loginName}
                onChange={(e) => {
                  setLoginName(e.target.value)
                  setLoginEdited(true)
                }}
                autoComplete="username"
                autoFocus={mode === 'login'}
                placeholder={mode === 'register' ? 'имя латиницей' : 'admin'}
                className={inputCls}
              />
            </div>
            {mode === 'register' && (
              <p className="mt-1 text-[11px] text-faint">
                Создаётся из Ф.И.О автоматически — можно изменить
              </p>
            )}
          </div>

          <Field icon={Lock} label="Пароль">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>

          {mode === 'register' && (
            <Field icon={KeyRound} label="Код приглашения">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Код от администратора"
                className={inputCls}
              />
            </Field>
          )}

          {error && <p className="mb-3 text-caption text-error">{error}</p>}

          <Button type="submit" className="mt-2 w-full" loading={loading} disabled={loading}>
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="mt-6 text-center text-caption text-faint">
          IT-HONA · Платформа управления задачами
        </p>
      </div>
    </div>
  )
}

const inputCls =
  'h-11 w-full rounded-input border border-line bg-bg pl-9 pr-3 text-small text-fg outline-none transition-colors focus:border-brand placeholder:text-faint'

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-caption font-medium text-muted">{label}</label>
      <div className="relative">
        <Icon
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        {children}
      </div>
    </div>
  )
}
