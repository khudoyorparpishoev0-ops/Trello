import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { CoreTile } from '@/components/ui/Logo'
import { login as apiLogin, register as apiRegister, requestRegistrationCode, type AuthUser } from '@/lib/api'
import { loginFromEmail } from '@/lib/translit'
import { domainsHint, emailDomainAllowed } from '@/lib/emailDomains'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'

interface LoginScreenProps {
  accountsEnabled: boolean
  /** true — код подтверждения приходит на рабочую почту; false — код от администратора. */
  emailVerification?: boolean
  onSuccess: (user?: AuthUser) => void
}

const ERRORS: Record<string, string> = {
  invalid_credentials: 'Неверный логин или пароль',
  bad_code: 'Неверный код приглашения',
  login_taken: 'Такой логин уже занят',
  invalid_fields: 'Проверьте поля: имя, логин от 3 символов, пароль от 6',
  email_domain_not_allowed: `Регистрация только с рабочей почты: ${domainsHint()}`,
  email_taken: 'На эту почту уже зарегистрирован аккаунт',
  invalid_email: 'Проверьте адрес почты',
  code_not_requested: 'Сначала запросите код на почту',
  code_expired: 'Код истёк — запросите новый',
  too_many_attempts: 'Слишком много попыток — запросите новый код',
  invalid_code: 'Неверный код из письма',
  mail_send_failed: 'Не удалось отправить письмо. Проверьте адрес или обратитесь к администратору',
  code_resend_wait: 'Письмо уже отправлено — подождите минуту',
  network: 'Нет связи с сервером',
}

// Надёжность пароля: по баллу за длину ≥8, ≥12, регистр, цифру, спецсимвол.
function passwordStrength(pw: string): { pct: number; color: string; ink: string; label: string } | null {
  if (!pw) return null
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 2) return { pct: 33, color: 'var(--err)', ink: 'text-err-ink', label: 'СЛАБЫЙ' }
  if (s === 3) return { pct: 66, color: 'var(--warn)', ink: 'text-warn-ink', label: 'СРЕДНИЙ' }
  return { pct: 100, color: 'var(--green)', ink: 'text-brand-ink', label: 'НАДЁЖНЫЙ' }
}

/**
 * Экран входа / регистрации. Колонка 400px, выключка влево — фирменная
 * подача брендбука: центрированного «окна авторизации» в системе нет.
 */
export function LoginScreen({ accountsEnabled, emailVerification, onSuccess }: LoginScreenProps) {
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
  const [codeSent, setCodeSent] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [notice, setNotice] = useState('')

  // Запрос кода подтверждения на рабочую почту.
  const requestCode = async () => {
    setError('')
    setNotice('')
    if (!emailDomainAllowed(email)) {
      setError(ERRORS.email_domain_not_allowed)
      return
    }
    setSendingCode(true)
    const r = await requestRegistrationCode(email.trim())
    setSendingCode(false)
    if (r.ok) {
      setCodeSent(true)
      setNotice(`Код отправлен на ${email.trim()} — письмо приходит за минуту`)
    } else {
      setError(ERRORS[r.error ?? ''] ?? 'Не удалось отправить код')
    }
  }

  // Логин создаётся из рабочей почты (часть до «@»), пока пользователь не
  // отредактировал его вручную.
  const onEmailChange = (value: string) => {
    setEmail(value)
    if (mode === 'register' && !loginEdited) setLoginName(loginFromEmail(value))
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
      // Ранняя проверка домена — чтобы не отправлять заведомо отклоняемый запрос.
      // Окончательное решение всё равно принимает сервер.
      if (!emailDomainAllowed(email)) {
        setError(ERRORS.email_domain_not_allowed)
        return
      }
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
    <div className="flex min-h-screen w-full items-center justify-center bg-page px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-[400px]">
        <CoreTile size={56} className="mb-6" />

        <p className="mono-label mb-1 text-muted">IT&#8209;HONA Platform</p>
        <h1 className="mb-2 text-h1">{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
        <p className="mb-8 text-body text-muted">
          {mode === 'login' ? 'Доступ только для команды.' : 'Аккаунт создаётся по коду с рабочей почты.'}
        </p>

        {accountsEnabled && (
          <div className="mb-8 flex overflow-hidden rounded-chip border border-line">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cn(
                  'h-11 flex-1 text-body transition-colors ease-smooth',
                  mode === m ? 'bg-brand-fill font-semibold text-white' : 'bg-surface text-muted hover:text-fg',
                )}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>
        )}

        <div key={mode} className="animate-slide-up">
          {mode === 'register' && (
            <>
              <Field label="Ф. И. О.">
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Иванов Иван Иванович" className={inputCls} />
              </Field>
              <Field label="Должность">
                <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Руководитель отдела" className={inputCls} />
              </Field>
              <Field label="Отдел">
                <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Проектирование" className={inputCls} />
              </Field>
              <Field
                label="E-mail"
                hint={`Только рабочая почта: ${domainsHint()}`}
                hintTone={email.trim() && !emailDomainAllowed(email) ? 'err' : 'faint'}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  autoComplete="email"
                  placeholder="ivan@ithona.tj"
                  className={cn(inputCls, email.trim() && !emailDomainAllowed(email) && 'border-err')}
                />
              </Field>
              <Field label="Дата рождения">
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}

          <Field
            label="Логин"
            hint={mode === 'register' ? 'Создаётся из e-mail автоматически — можно изменить.' : undefined}
          >
            <input
              value={loginName}
              onChange={(e) => { setLoginName(e.target.value); setLoginEdited(true) }}
              autoComplete="username"
              autoFocus={mode === 'login'}
              placeholder={mode === 'register' ? 'имя латиницей' : 'a.karimov'}
              className={inputCls}
            />
          </Field>

          <Field label="Пароль">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className={cn(inputCls, 'pr-12')}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-chip text-faint transition-colors hover:bg-hover hover:text-muted"
              >
                {showPw ? <EyeOff size={18} strokeWidth={1.6} /> : <Eye size={18} strokeWidth={1.6} />}
              </button>
            </div>
            {strength && (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden bg-track">
                  <div
                    className="h-full transition-[width] duration-200"
                    style={{ width: `${strength.pct}%`, background: strength.color }}
                  />
                </div>
                <span className={cn('mono-data min-w-[64px] text-right', strength.ink)}>{strength.label}</span>
              </div>
            )}
          </Field>

          {mode === 'register' &&
            (emailVerification ? (
              <Field
                label="Код из письма"
                hint={
                  codeSent
                    ? 'Проверьте почту — код действует 15 минут.'
                    : 'Нажмите «Отправить код» — письмо придёт на рабочую почту.'
                }
              >
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6 цифр"
                    className={cn(inputCls, 'flex-1 font-mono tracking-[0.3em]')}
                  />
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={sendingCode || !email.trim()}
                    className="h-11 shrink-0 rounded-btn border border-line-strong px-3 text-small font-semibold text-fg transition-colors hover:bg-hover disabled:opacity-40"
                  >
                    {sendingCode ? '…' : codeSent ? 'Ещё раз' : 'Отправить код'}
                  </button>
                </div>
              </Field>
            ) : (
              <Field label="Код приглашения">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код от администратора" className={inputCls} />
              </Field>
            ))}

          {mode === 'login' && (
            <div className="mb-6 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-caption text-muted">
                <Checkbox checked={remember} onChange={() => setRemember((v) => !v)} label="Запомнить меня" />
                Запомнить меня
              </label>
              <button
                type="button"
                onClick={() => setForgot(true)}
                className="text-caption font-semibold text-brand-ink hover:underline"
              >
                Забыли пароль?
              </button>
            </div>
          )}

          {error && (
            <p className="mb-4 border-l-2 border-l-err bg-err-bg px-3 py-2 text-caption text-err-ink">{error}</p>
          )}
          {!error && notice && (
            <p className="mb-4 flex items-start gap-2 border-l-2 border-l-brand bg-brand-bg px-3 py-2 text-caption text-brand-ink">
              <Check size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-btn bg-brand-fill text-body font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" strokeWidth={1.6} /> : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </div>

        {/* Подсказки — блок с левой линией 2px (брендбук §04) */}
        <div className="mt-6 border-l-2 border-l-line pl-4">
          <p className="text-caption text-muted">
            {forgot
              ? 'Пароль сбрасывает администратор — раздел «Компания». Обратитесь к нему.'
              : 'Пароль сбрасывает администратор — раздел «Компания».'}
          </p>
          <p className="mt-1 text-caption text-muted">
            Регистрация — по коду из письма на{' '}
            <span className="font-mono text-caption text-fg">{domainsHint()}</span>.
          </p>
        </div>
      </form>
    </div>
  )
}

const inputCls =
  'h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none transition-colors focus:border-brand placeholder:text-faint'

function Field({
  label,
  hint,
  hintTone = 'faint',
  children,
}: {
  label: string
  hint?: string
  hintTone?: 'faint' | 'err'
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <span className="mono-label mb-2 block text-muted">{label}</span>
      {children}
      {hint && (
        <span className={cn('mt-2 block text-caption', hintTone === 'err' ? 'text-err-ink' : 'text-faint')}>
          {hint}
        </span>
      )}
    </div>
  )
}
