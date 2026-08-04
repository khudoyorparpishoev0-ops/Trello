import { useState, type FormEvent, type ReactNode } from 'react'
import {
  SquareKanban,
  Lock,
  User,
  IdCard,
  KeyRound,
  Building2,
  Cake,
  Briefcase,
  Mail,
  Eye,
  EyeOff,
  Check,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

// Надёжность пароля: по баллу за длину ≥8, ≥12, регистр, цифру, спецсимвол.
function passwordStrength(pw: string): { pct: number; color: string; label: string } | null {
  if (!pw) return null
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 2) return { pct: 33, color: '#EF4444', label: 'слабый' }
  if (s === 3) return { pct: 66, color: '#F59E0B', label: 'средний' }
  return { pct: 100, color: '#16A34A', label: 'надёжный' }
}

/** Экран входа / регистрации (хендофф §1). Регистрация — при включённых аккаунтах. */
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
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [forgot, setForgot] = useState(false)
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
        !name.trim() || !loginName.trim() || !password || !code.trim() ||
        !department.trim() || !birthday || !email.trim() || !position.trim()
      )
        return
      setLoading(true)
      const r = await apiRegister({
        name: name.trim(), login: loginName.trim(), password, code: code.trim(),
        department: department.trim(), birthday, email: email.trim(), position: position.trim(),
      })
      setLoading(false)
      if (r.ok) onSuccess(r.user)
      else setError(ERRORS[r.error ?? ''] ?? 'Не удалось зарегистрироваться')
    }
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
    setForgot(false)
    if (m === 'register') setLoginEdited(false)
  }

  const strength = mode === 'register' ? passwordStrength(password) : null

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg px-6 py-12">
      {/* Логотип-блок */}
      <div className="mb-7 flex flex-col items-center gap-3">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand"
          style={{ boxShadow: '0 10px 30px color-mix(in srgb, #16a34a 28%, transparent)' }}
        >
          <SquareKanban size={28} strokeWidth={2.5} className="text-white" />
        </span>
        <div className="text-center leading-none">
          <div className="text-[26px] font-bold tracking-tight text-fg">IT-HONA</div>
          <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-faint">
            TASKBOARD
          </div>
        </div>
      </div>

      {/* Карточка формы */}
      <form
        onSubmit={submit}
        className="w-full max-w-[412px] rounded-[20px] border border-line bg-surface p-6"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.42)' }}
      >
        {accountsEnabled ? (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-btn border border-line bg-col p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'h-10 rounded-[11px] text-small transition-all duration-200',
                  mode === m
                    ? 'bg-surface font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.28)]'
                    : 'font-medium text-muted hover:text-fg',
                )}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-fg">Вход</h1>
            <p className="mb-5 text-caption text-muted">Доступ только для команды</p>
          </>
        )}

        <div key={mode} className="animate-slide-up">
          {mode === 'register' && (
            <>
              <Field icon={IdCard} label="Ф.И.О">
                <input value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus placeholder="Иванов Иван Иванович" className={inputCls} />
              </Field>
              <Field icon={Briefcase} label="Должность">
                <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Руководитель отдела" className={inputCls} />
              </Field>
              <Field icon={Building2} label="Отдел">
                <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Разработка" className={inputCls} />
              </Field>
              <Field icon={Mail} label="E-mail">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="ivan@ithona.tj" className={inputCls} />
              </Field>
              <Field icon={Cake} label="Дата рождения">
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}

          {/* Логин */}
          <div className="mb-3.5">
            <label className="mb-[7px] block text-[12.5px] font-medium text-muted">Логин</label>
            <div className="relative">
              <User size={16} strokeWidth={2} className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={loginName}
                onChange={(e) => { setLoginName(e.target.value); setLoginEdited(true) }}
                autoComplete="username"
                autoFocus={mode === 'login'}
                placeholder={mode === 'register' ? 'имя латиницей' : 'admin'}
                className={inputCls}
              />
            </div>
            {mode === 'register' && (
              <p className="mt-1 text-[11.5px] text-faint">Создаётся из Ф.И.О автоматически — можно изменить</p>
            )}
          </div>

          {/* Пароль */}
          <div className="mb-3.5">
            <label className="mb-[7px] block text-[12.5px] font-medium text-muted">Пароль</label>
            <div className="relative">
              <Lock size={16} strokeWidth={2} className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-faint" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className={cn(inputCls, 'pr-[46px]')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[10px] text-faint transition-colors hover:bg-hover hover:text-muted"
              >
                {showPw ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </button>
            </div>
            {strength && (
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-1 flex-1 overflow-hidden rounded-pill bg-line">
                  <div className="h-full rounded-pill transition-[width] duration-200" style={{ width: `${strength.pct}%`, background: strength.color }} />
                </div>
                <span className="min-w-[56px] text-right text-[11.5px] font-medium" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <Field icon={KeyRound} label="Код приглашения">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код от администратора" className={inputCls} />
            </Field>
          )}

          {/* Запомнить / Забыли пароль — только вход */}
          {mode === 'login' && (
            <div className="mb-4 flex items-center justify-between">
              <button type="button" onClick={() => setRemember((v) => !v)} className="flex items-center gap-2 text-caption text-muted">
                <span className={cn('flex h-[19px] w-[19px] items-center justify-center rounded-[6px] border transition-colors', remember ? 'border-brand bg-brand text-white' : 'border-line-strong text-transparent')}>
                  <Check size={12} strokeWidth={3} />
                </span>
                Запомнить меня
              </button>
              <button type="button" onClick={() => setForgot(true)} className="text-caption font-medium text-brand hover:brightness-[1.15]">
                Забыли пароль?
              </button>
            </div>
          )}
          {forgot && mode === 'login' && (
            <p className="mb-3 text-[11.5px] text-faint">Обратитесь к администратору — он сбросит пароль в разделе «Компания».</p>
          )}

          {error && <p className="mb-3 text-caption text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-brand text-[14.5px] font-semibold text-white transition-[filter] duration-150 hover:brightness-[1.08] disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </div>
      </form>

      <p className="mt-7 text-center text-[12.5px] font-medium text-faint">
        IT-HONA · Платформа управления задачами
      </p>
    </div>
  )
}

const inputCls =
  'h-[46px] w-full rounded-btn border border-line bg-col pl-10 pr-3 text-small text-fg outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand focus:shadow-[0_0_0_3px_rgba(22,163,74,0.2)] placeholder:text-faint'

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="mb-[7px] block text-[12.5px] font-medium text-muted">{label}</label>
      <div className="relative">
        <Icon size={16} strokeWidth={2} className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-faint" />
        {children}
      </div>
    </div>
  )
}
