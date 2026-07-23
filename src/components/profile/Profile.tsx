import { useRef, useState } from 'react'
import {
  Menu,
  Sun,
  Moon,
  Camera,
  Trash2,
  LogOut,
  KeyRound,
  Mail,
  Briefcase,
  Building2,
  Cake,
  User as UserIcon,
  Crown,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { useBoard } from '@/store/boardStore'
import { changePassword, updateProfile, updateAvatar } from '@/lib/api'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface ProfileProps {
  onMenuClick: () => void
}

/** Центрирует и сжимает картинку до квадрата 256×256 → data-URL (JPEG). */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2
      const out = 256
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no-ctx'))
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load-error'))
    }
    img.src = url
  })
}

export function Profile({ onMenuClick }: ProfileProps) {
  const { user, updateUser, logout, authActive } = useAuth()
  const { theme, toggle } = useTheme()
  const { departments } = useBoard()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')

  const hasAccount = !!user?.id
  const roleLabel = user?.role === 'admin' ? 'Админ пространства' : 'Участник'

  const pickPhoto = () => fileRef.current?.click()
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // чтобы повторный выбор того же файла срабатывал
    if (!file) return
    setPhotoErr('')
    setPhotoBusy(true)
    try {
      const dataUrl = await fileToAvatar(file)
      const r = await updateAvatar(dataUrl)
      if (r.ok) updateUser({ avatar: r.avatar ?? dataUrl })
      else setPhotoErr(r.error === 'image_too_large' ? 'Файл слишком большой' : 'Не удалось загрузить')
    } catch {
      setPhotoErr('Не удалось обработать изображение')
    } finally {
      setPhotoBusy(false)
    }
  }
  const removePhoto = async () => {
    setPhotoErr('')
    setPhotoBusy(true)
    const r = await updateAvatar('')
    if (r.ok) updateUser({ avatar: '' })
    else setPhotoErr('Не удалось удалить')
    setPhotoBusy(false)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <IconButton icon={Menu} label="Меню" size="sm" onClick={onMenuClick} className="-ml-1 shrink-0 lg:hidden" />
          <h1 className="min-w-0 truncate text-h3 font-semibold text-fg">Мой профиль</h1>
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            size="sm"
            onClick={toggle}
            className="ml-auto"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5 sm:gap-6">
          {/* Шапка профиля */}
          <section className="rounded-card border border-line bg-surface p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-24 w-24 rounded-pill object-cover ring-2 ring-line"
                  />
                ) : (
                  <span
                    className="flex h-24 w-24 items-center justify-center rounded-pill text-h1 font-semibold text-white ring-2 ring-line"
                    style={{ background: user?.color ?? '#3B82F6' }}
                  >
                    {user?.initials ?? '?'}
                  </span>
                )}
                {photoBusy && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-pill bg-black/40">
                    <Loader2 size={22} className="animate-spin text-white" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <span className="truncate text-h3 font-semibold text-fg">{user?.name ?? 'Гость'}</span>
                  {user?.role === 'admin' && <Crown size={15} className="shrink-0 text-warning" />}
                </div>
                {user?.login && <div className="text-caption text-faint">@{user.login} · {roleLabel}</div>}

                {hasAccount && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                    <Button variant="secondary" size="sm" icon={Camera} onClick={pickPhoto} disabled={photoBusy}>
                      Загрузить фото
                    </Button>
                    {user?.avatar && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        disabled={photoBusy}
                        className="inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-caption font-medium text-muted hover:text-error disabled:opacity-50"
                      >
                        <Trash2 size={14} strokeWidth={2} /> Удалить фото
                      </button>
                    )}
                  </div>
                )}
                {photoErr && <p className="mt-2 text-caption text-error">{photoErr}</p>}
              </div>

              {authActive && (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-btn px-2.5 py-1.5 text-caption font-medium text-muted hover:bg-hover hover:text-error"
                >
                  <LogOut size={15} strokeWidth={2} /> Выход
                </button>
              )}
            </div>
          </section>

          {hasAccount ? (
            <>
              <ProfileForm
                initial={{
                  name: user!.name,
                  email: user!.email ?? '',
                  position: user!.position ?? '',
                  department: user!.department ?? '',
                  birthday: user!.birthday ?? '',
                }}
                departments={departments}
                onSaved={(u) => updateUser(u)}
              />
              <PasswordForm />
            </>
          ) : (
            <section className="rounded-card border border-line bg-surface p-5">
              <p className="text-small text-muted">
                Личные данные и смена пароля доступны при входе под личным аккаунтом.
              </p>
            </section>
          )}

          {/* Внешний вид */}
          <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
            <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-muted">Внешний вид</h2>
            <div className="flex items-center gap-3">
              <ThemeCard active={theme === 'dark'} icon={Moon} label="Тёмная" onClick={() => theme !== 'dark' && toggle()} />
              <ThemeCard active={theme === 'light'} icon={Sun} label="Светлая" onClick={() => theme !== 'light' && toggle()} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Sun
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-card border py-3 text-small font-medium transition-colors',
        active ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted hover:border-line-strong hover:text-fg',
      )}
    >
      <Icon size={18} strokeWidth={2} /> {label}
    </button>
  )
}

function ProfileForm({
  initial,
  departments,
  onSaved,
}: {
  initial: { name: string; email: string; position: string; department: string; birthday: string }
  departments: string[]
  onSaved: (patch: { name: string; email: string; position: string; department: string; birthday: string; initials: string }) => void
}) {
  const [f, setF] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const deptOptions = departments.includes(f.department) || !f.department ? departments : [f.department, ...departments]

  const save = async () => {
    setMsg(null)
    setLoading(true)
    const r = await updateProfile(f)
    setLoading(false)
    if (r.ok && r.user) {
      onSaved({
        name: r.user.name,
        email: r.user.email ?? '',
        position: r.user.position ?? '',
        department: r.user.department ?? '',
        birthday: r.user.birthday ?? '',
        initials: r.user.initials,
      })
      setMsg({ ok: true, text: 'Сохранено' })
    } else {
      setMsg({ ok: false, text: r.error === 'invalid_fields' ? 'Проверьте поля (e-mail, дата, должность)' : 'Не удалось сохранить' })
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-muted">Личные данные</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field icon={UserIcon} label="Имя и фамилия">
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Field>
        <Field icon={Mail} label="E-mail">
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
        </Field>
        <Field icon={Briefcase} label="Должность">
          <input value={f.position} onChange={(e) => set('position', e.target.value)} className={inputCls} />
        </Field>
        <Field icon={Building2} label="Отдел">
          <select value={f.department} onChange={(e) => set('department', e.target.value)} className={inputCls}>
            <option value="">— выбрать —</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field icon={Cake} label="Дата рождения">
          <input type="date" value={f.birthday} onChange={(e) => set('birthday', e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={loading} disabled={loading}>
          Сохранить
        </Button>
        {msg && <span className={cn('text-caption', msg.ok ? 'text-success' : 'text-error')}>{msg.text}</span>}
      </div>
    </section>
  )
}

function PasswordForm() {
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async () => {
    setMsg(null)
    if (nw.length < 6) return setMsg({ ok: false, text: 'Новый пароль — минимум 6 символов' })
    if (nw !== confirm) return setMsg({ ok: false, text: 'Пароли не совпадают' })
    setLoading(true)
    const r = await changePassword(cur, nw)
    setLoading(false)
    if (r.ok) {
      setCur('')
      setNw('')
      setConfirm('')
      setMsg({ ok: true, text: 'Пароль изменён' })
    } else {
      setMsg({ ok: false, text: r.error === 'wrong_password' ? 'Текущий пароль неверный' : 'Не удалось изменить' })
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-muted">
        <KeyRound size={14} strokeWidth={2} /> Сменить пароль
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Текущий пароль">
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} autoComplete="current-password" />
        </Field>
        <Field label="Новый пароль">
          <input type="password" value={nw} onChange={(e) => setNw(e.target.value)} className={inputCls} autoComplete="new-password" />
        </Field>
        <Field label="Повторите">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} loading={loading} disabled={loading}>
          Сменить пароль
        </Button>
        {msg && <span className={cn('text-caption', msg.ok ? 'text-success' : 'text-error')}>{msg.text}</span>}
      </div>
    </section>
  )
}

const inputCls =
  'w-full rounded-input border border-line bg-bg px-3 py-2 text-small text-fg outline-none focus:border-brand placeholder:text-faint'

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon?: typeof Sun
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-caption font-medium text-muted">
        {Icon && <Icon size={13} strokeWidth={2} />} {label}
      </span>
      {children}
    </label>
  )
}
