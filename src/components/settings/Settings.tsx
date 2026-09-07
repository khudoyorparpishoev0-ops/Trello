import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Sun,
  Moon,
  LogOut,
  Camera,
  Smile,
  Lock,
  Mail,
  Bell,
  Send,
  Link2,
  Copy,
  Check,
  LayoutGrid,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { useBoard } from '@/store/boardStore'
import {
  changePassword,
  updateProfile,
  updateAvatar,
  telegramStatus,
  telegramLink,
  telegramUnlink,
} from '@/lib/api'
import { imageToBackground } from '@/lib/backgrounds'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/utils'

interface SettingsProps {
  onMenuClick: () => void
}

interface EventRow {
  name: string
  on: boolean
  sound: boolean
  browser: boolean
  push: boolean
}

const TASK_EVENTS: EventRow[] = [
  { name: 'Сообщение в чате задачи', on: true, sound: true, browser: true, push: true },
  { name: 'Упоминание через @ в чате задачи', on: true, sound: true, browser: true, push: true },
  { name: 'Пропуск своего дедлайна', on: true, sound: true, browser: true, push: true },
  { name: 'Пропуск чужого дедлайна', on: false, sound: false, browser: false, push: false },
  { name: 'Выполнение задачи', on: true, sound: true, browser: true, push: true },
  { name: 'Перемещение задачи в другую колонку/доску', on: false, sound: false, browser: false, push: false },
  { name: 'Назначение вас исполнителем', on: true, sound: true, browser: true, push: true },
  { name: 'Назначение исполнителем другого пользователя', on: false, sound: false, browser: false, push: false },
]
const CHAT_EVENTS: EventRow[] = [
  { name: 'Сообщение в групповом чате', on: true, sound: true, browser: true, push: true },
  { name: 'Упоминание через @ в групповом чате', on: true, sound: true, browser: true, push: true },
  { name: 'Сообщение в личном чате', on: true, sound: true, browser: true, push: true },
]
// Тона — из палитры брендбука (зелёная шкала и нейтрали).
const BOARD_BGS = [
  { id: 'ink', color: '#0B120E' },
  { id: 'graphite', color: '#101613' },
  { id: 'forest', color: '#0E3B21' },
  { id: 'green', color: '#186B36' },
  { id: 'light', color: '#F5F7F5' },
]

// Сжать картинку в квадрат 256×256 (JPEG data-URL) для аватара.
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('no-ctx'))
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')) }
    img.src = url
  })
}

export function Settings({ onMenuClick }: SettingsProps) {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Профиль и система"
        title="Настройки"
        subtitle="Профиль, уведомления, внешний вид и компании"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
          <ProfileCard />
          <NotificationsCard />
          <AppearanceCard />
          <CompaniesCard />
        </div>
      </div>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/* ——— 1. Профиль ——— */
function ProfileCard() {
  const { user, updateUser, logout, authActive } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [publicLink, setPublicLink] = useState(true)
  const [copied, setCopied] = useState(false)
  const [tg, setTg] = useState({ enabled: false, linked: false })

  useEffect(() => {
    void telegramStatus().then((s) => s && setTg({ enabled: s.enabled, linked: s.linked }))
  }, [])

  const canPersist = !!user?.id && !!user.email && !!user.department && !!user.position && !!user.birthday
  const saveName = () => {
    const n = name.trim()
    if (!n || n === user?.name) return
    updateUser({ name: n })
    if (canPersist) {
      void updateProfile({
        name: n, email: user!.email!, department: user!.department!,
        position: user!.position!, birthday: user!.birthday!,
      })
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await fileToAvatar(file)
      const r = await updateAvatar(dataUrl)
      updateUser({ avatar: r.ok ? r.avatar ?? dataUrl : dataUrl })
    } catch { /* ignore */ }
    setBusy(false)
  }
  const removePhoto = async () => {
    setBusy(true)
    await updateAvatar('')
    updateUser({ avatar: '' })
    setBusy(false)
  }

  const toggleTelegram = async () => {
    if (!tg.enabled) return
    if (tg.linked) {
      await telegramUnlink()
      setTg((s) => ({ ...s, linked: false }))
    } else {
      const r = await telegramLink()
      if (r?.deepLink) window.open(r.deepLink, '_blank', 'noopener')
    }
  }

  const inviteLink = `it-hona.uz/invite/${(user?.id ?? 'lx1JACQwdBco3PZL').slice(-16)}`
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText('https://' + inviteLink) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card
      title="Профиль"
      action={
        authActive ? (
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-11 items-center gap-2 rounded-btn border border-err px-3 text-small font-semibold text-err-ink transition-colors hover:bg-err-bg"
          >
            <LogOut size={16} strokeWidth={1.6} /> Выход из аккаунта
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {/* Аватар + имя */}
        <div className="flex flex-wrap gap-6">
          <div className="flex shrink-0 gap-3">
            <div className="relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-24 w-24 rounded-chip border border-line object-cover"
                />
              ) : (
                <span className="mono-data flex h-24 w-24 items-center justify-center rounded-chip bg-sidebar-active text-[26px] tracking-normal text-white">
                  {user?.initials ?? '?'}
                </span>
              )}
              {busy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-chip bg-black/40">
                  <Loader2 size={20} className="animate-spin text-white" strokeWidth={1.6} />
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex h-11 items-center gap-2 rounded-btn border border-line-strong px-3 text-small font-semibold text-fg transition-colors hover:bg-hover"
              >
                <Camera size={16} strokeWidth={1.6} /> Загрузить фото
              </button>
              {user?.avatar && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={busy}
                  className="text-left text-caption font-semibold text-muted transition-colors hover:text-err-ink"
                >
                  Удалить фото
                </button>
              )}
            </div>
          </div>

          <div className="flex min-w-[280px] flex-1 flex-col gap-3">
            <label className="block">
              <span className="mono-label mb-2 block text-muted">Имя и фамилия</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                className="h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none transition-colors focus:border-brand"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-chip border border-dashed border-line-strong px-3 text-small text-muted transition-colors hover:border-brand hover:text-fg"
              >
                <Smile size={16} strokeWidth={1.6} /> Установить статус
              </button>
              <span className="inline-flex h-11 items-center gap-2 rounded-chip bg-mist px-3 text-caption text-muted">
                <span className="h-2 w-2 bg-ok" />
                {user?.position || 'Руководитель'} · {user?.department ? shortDept(user.department) : 'Администрация'}
              </span>
            </div>
          </div>
        </div>

        {/* Ряд действий */}
        <div className="grid gap-2 border-t border-line pt-5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <ActionButton icon={Lock} label="Сменить пароль" onClick={() => setPwOpen(true)} />
          <ActionButton icon={Mail} label="Сменить e-mail" onClick={() => setEmailOpen(true)} />
          <ActionButton icon={Bell} label="Настройки e-mail оповещений" onClick={() => {}} />
        </div>

        {/* Интеграции */}
        <div className="flex flex-col gap-0.5">
          <IntegrationRow
            icon={Send}
            title="Интеграция с Telegram"
            hint={tg.enabled ? 'уведомления о задачах в личный чат' : 'бот не настроен на сервере'}
            checked={tg.linked}
            disabled={!tg.enabled}
            onToggle={toggleTelegram}
          />
          <IntegrationRow
            icon={Link2}
            title="Доступ по ссылке в мой профиль"
            checked={publicLink}
            onToggle={() => setPublicLink((v) => !v)}
          />
          {publicLink && (
            <div className="mx-3 mt-1 flex items-center gap-2 rounded-chip border border-line bg-mist p-2 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-caption text-muted">{inviteLink}</span>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip bg-surface px-2.5 text-caption font-semibold text-muted transition-colors hover:bg-brand-bg hover:text-brand-ink"
              >
                {copied ? <Check size={14} strokeWidth={1.6} /> : <Copy size={14} strokeWidth={1.6} />}
                {copied ? 'Готово' : 'Скопировать'}
              </button>
            </div>
          )}
        </div>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      {emailOpen && user && (
        <EmailModal
          user={user}
          onClose={() => setEmailOpen(false)}
          onSaved={(email) => updateUser({ email })}
        />
      )}
    </Card>
  )
}

function shortDept(d: string): string {
  return d.length > 22 ? d.slice(0, 20) + '…' : d
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof Lock; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] items-center gap-3 rounded-chip px-3 py-2.5 text-left text-body text-fg transition-colors hover:bg-hover"
    >
      <Icon size={18} strokeWidth={1.6} className="text-muted" />
      {label}
    </button>
  )
}

function IntegrationRow({
  icon: Icon, title, hint, checked, onToggle, disabled,
}: {
  icon: typeof Send; title: string; hint?: string; checked: boolean; onToggle: () => void; disabled?: boolean
}) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-chip px-3 py-2.5 transition-colors hover:bg-hover">
      <Icon size={18} strokeWidth={1.6} className="shrink-0 text-muted" />
      <span className="text-body text-fg">{title}</span>
      {hint && <span className="truncate text-caption text-faint">{hint}</span>}
      <span className="ml-auto">
        <Toggle checked={checked} onChange={onToggle} disabled={disabled} label={title} />
      </span>
    </div>
  )
}

/* ——— 2. Уведомления ——— */
function NotificationsCard() {
  const [task, setTask] = useState(TASK_EVENTS)
  const [chat, setChat] = useState(CHAT_EVENTS)
  const [hideSystem, setHideSystem] = useState(true)

  const toggleEvent = (group: 'task' | 'chat', i: number) => {
    const set = group === 'task' ? setTask : setChat
    set((rows) =>
      rows.map((r, idx) =>
        idx !== i ? r : r.on ? { ...r, on: false, sound: false, browser: false, push: false } : { ...r, on: true },
      ),
    )
  }
  const toggleChannel = (group: 'task' | 'chat', i: number, ch: 'sound' | 'browser' | 'push') => {
    const set = group === 'task' ? setTask : setChat
    set((rows) => rows.map((r, idx) => (idx !== i || !r.on ? r : { ...r, [ch]: !r[ch] })))
  }

  return (
    <Card title="Уведомления">
      <div className="flex flex-col gap-[22px]">
        <div className="flex min-h-[56px] items-center gap-3 rounded-chip border border-line bg-mist px-4 py-3">
          <span className="text-body text-fg">Скрывать системные сообщения в чате после просмотра</span>
          <span className="ml-auto">
            <Toggle checked={hideSystem} onChange={() => setHideSystem((v) => !v)} label="Скрывать системные сообщения" />
          </span>
        </div>

        <EventTable title="Чаты задач" group="task" rows={task} onToggleEvent={toggleEvent} onToggleChannel={toggleChannel} />
        <div className="border-t border-line pt-[18px]">
          <EventTable title="Личные и групповые чаты" group="chat" rows={chat} onToggleEvent={toggleEvent} onToggleChannel={toggleChannel} />
        </div>
      </div>
    </Card>
  )
}

const GRID = '[grid-template-columns:2.4fr_repeat(4,116px)]'

function EventTable({
  title, group, rows, onToggleEvent, onToggleChannel,
}: {
  title: string
  group: 'task' | 'chat'
  rows: EventRow[]
  onToggleEvent: (g: 'task' | 'chat', i: number) => void
  onToggleChannel: (g: 'task' | 'chat', i: number, ch: 'sound' | 'browser' | 'push') => void
}) {
  return (
    <div>
      <h3 className="mono-label mb-4 text-muted">{title}</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Шапка */}
          <div className={cn('mono-label grid gap-3 border-b border-line px-3 pb-3 text-faint', GRID)}>
            <span>Событие</span>
            <ColHead>Включить событие</ColHead>
            <ColHead>Звуковое уведомление</ColHead>
            <ColHead>Уведомление в браузере</ColHead>
            <ColHead>Push в мобильном</ColHead>
          </div>
          {rows.map((r, i) => (
            <div key={r.name} className={cn('grid min-h-[44px] items-center gap-3 rounded-chip px-3 py-2 transition-colors hover:bg-hover', GRID)}>
              <span className={cn('text-body', r.on ? 'text-fg' : 'text-faint')}>{r.name}</span>
              <div className="flex justify-center">
                <Toggle size="sm" checked={r.on} onChange={() => onToggleEvent(group, i)} label={r.name} />
              </div>
              <Channel on={r.on} checked={r.sound} onToggle={() => onToggleChannel(group, i, 'sound')} />
              <Channel on={r.on} checked={r.browser} onToggle={() => onToggleChannel(group, i, 'browser')} />
              <Channel on={r.on} checked={r.push} onToggle={() => onToggleChannel(group, i, 'push')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColHead({ children }: { children: ReactNode }) {
  return <span className="text-center leading-[13px]">{children}</span>
}

function Channel({ on, checked, onToggle }: { on: boolean; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        disabled={!on}
        onClick={onToggle}
        aria-checked={on && checked}
        role="checkbox"
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-chip border transition-colors',
          !on
            ? 'cursor-default border-line text-transparent'
            : checked
              ? 'cursor-pointer border-transparent bg-brand-fill text-white'
              : 'cursor-pointer border-line-strong text-transparent hover:border-muted',
        )}
      >
        <Check size={12} strokeWidth={2.4} />
      </button>
    </div>
  )
}

/* ——— 3. Внешний вид ——— */
function AppearanceCard() {
  const { theme, toggle } = useTheme()
  const { activeBoardId, actions } = useBoard()
  const fileRef = useRef<HTMLInputElement>(null)
  const [colColors, setColColors] = useState(true)
  const [bgChoice, setBgChoice] = useState('graphite')

  const pickTheme = (t: 'dark' | 'light') => {
    if (t !== theme) toggle()
  }
  const pickBg = (id: string, color: string) => {
    setBgChoice(id)
    if (activeBoardId) actions.setBoardBackground(activeBoardId, color)
  }
  const onBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeBoardId) return
    try {
      const dataUrl = await imageToBackground(file)
      actions.setBoardBackground(activeBoardId, dataUrl)
      setBgChoice('custom')
    } catch { /* ignore */ }
  }

  return (
    <Card title="Внешний вид системы">
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        {/* Левая колонка */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="mono-label mb-3 block text-muted">Цветовая схема</span>
            <div className="flex gap-3">
              <ThemeRadio active={theme === 'dark'} tone="dark" label="Тёмная" onClick={() => pickTheme('dark')} />
              <ThemeRadio active={theme === 'light'} tone="light" label="Светлая" onClick={() => pickTheme('light')} />
            </div>
          </div>
          <div className="flex min-h-[44px] items-center gap-3 rounded-chip px-3 py-2.5 transition-colors hover:bg-hover">
            <span className="text-body text-fg">Цветные полосы у колонок</span>
            <span className="ml-auto">
              <Toggle checked={colColors} onChange={() => setColColors((v) => !v)} label="Цветные полосы у колонок" />
            </span>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="mono-label mb-3 block text-muted">Язык интерфейса</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="h-11 min-w-[150px] rounded-btn border-2 border-brand bg-brand-bg px-4 text-body font-semibold text-fg"
              >
                Русский
              </button>
            </div>
          </div>
          <div>
            <span className="mono-label mb-3 mt-1 block text-muted">Фон досок</span>
            <div className="flex flex-wrap gap-2.5">
              {BOARD_BGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pickBg(b.id, b.color)}
                  className={cn(
                    'relative h-[52px] w-[78px] rounded-chip border-2 transition-colors',
                    bgChoice === b.id ? 'border-brand' : 'border-line',
                  )}
                  style={{ background: b.color }}
                >
                  {bgChoice === b.id && (
                    <span className="absolute bottom-1.5 right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-chip bg-brand-fill text-white">
                      <Check size={11} strokeWidth={2.4} />
                    </span>
                  )}
                </button>
              ))}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onBgFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-[52px] w-[78px] items-center justify-center rounded-chip border-2 border-dashed border-line-strong text-muted transition-colors hover:border-brand hover:text-brand-ink"
              >
                <Plus size={18} strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ThemeRadio({ active, tone, label, onClick }: { active: boolean; tone: 'dark' | 'light'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-start gap-3 rounded-card border-2 p-4 text-left transition-colors',
        active ? 'border-brand bg-brand-bg text-brand-ink' : 'border-line text-muted hover:border-line-strong',
      )}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-chip border"
        style={
          tone === 'dark'
            ? { background: '#0B120E', borderColor: '#26332B' }
            : { background: '#F5F7F5', borderColor: '#E3E7E3' }
        }
      >
        {tone === 'dark' ? (
          <Moon size={18} strokeWidth={1.6} className="text-white" />
        ) : (
          <Sun size={18} strokeWidth={1.6} style={{ color: '#101613' }} />
        )}
      </span>
      <span className="text-body font-semibold">{label}</span>
    </button>
  )
}

/* ——— 4. Компании ——— */
function CompaniesCard() {
  const companies = [
    { name: 'it-hona', current: true },
    { name: 'тест', current: false },
  ]
  return (
    <Card title="Компании">
      <div className="flex flex-col gap-[2px]">
        {companies.map((c) => (
          <div key={c.name} className="flex min-h-[44px] items-center gap-3 rounded-chip p-3 transition-colors hover:bg-hover">
            <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-mist text-muted">
              <LayoutGrid size={18} strokeWidth={1.6} />
            </span>
            <span className="text-body font-semibold text-fg">{c.name}</span>
            {c.current && (
              <span className="mono-label border-l-2 border-l-brand bg-brand-bg px-2 py-1 text-brand-ink">Текущая</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ——— Модалки ——— */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-[400px] rounded-modal border border-line bg-elevated p-6 shadow-md animate-scale-in">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-h3">{title}</h3>
          <IconButton icon={X} label="Закрыть" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}

const modalInput =
  'h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none transition-colors focus:border-brand placeholder:text-faint'

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const submit = async () => {
    setMsg(null)
    if (nw.length < 6) return setMsg({ ok: false, text: 'Минимум 6 символов' })
    if (nw !== confirm) return setMsg({ ok: false, text: 'Пароли не совпадают' })
    setLoading(true)
    const r = await changePassword(cur, nw)
    setLoading(false)
    if (r.ok) { setMsg({ ok: true, text: 'Пароль изменён' }); setCur(''); setNw(''); setConfirm('') }
    else setMsg({ ok: false, text: r.error === 'wrong_password' ? 'Текущий пароль неверный' : 'Не удалось' })
  }
  return (
    <ModalShell title="Сменить пароль" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input type="password" placeholder="Текущий пароль" value={cur} onChange={(e) => setCur(e.target.value)} className={modalInput} autoComplete="current-password" />
        <input type="password" placeholder="Новый пароль" value={nw} onChange={(e) => setNw(e.target.value)} className={modalInput} autoComplete="new-password" />
        <input type="password" placeholder="Повторите" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={modalInput} autoComplete="new-password" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} loading={loading} disabled={loading}>Сменить</Button>
        {msg && <span className={cn('text-caption', msg.ok ? 'text-ok-ink' : 'text-err-ink')}>{msg.text}</span>}
      </div>
    </ModalShell>
  )
}

function EmailModal({ user, onClose, onSaved }: { user: { email?: string; name: string; department?: string; position?: string; birthday?: string }; onClose: () => void; onSaved: (email: string) => void }) {
  const [email, setEmail] = useState(user.email ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const submit = async () => {
    setMsg(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMsg({ ok: false, text: 'Неверный e-mail' })
    setLoading(true)
    const r = await updateProfile({
      name: user.name, email, department: user.department ?? '', position: user.position ?? '', birthday: user.birthday ?? '',
    })
    setLoading(false)
    if (r.ok) { onSaved(email); onClose() }
    else setMsg({ ok: false, text: 'Не удалось сохранить' })
  }
  return (
    <ModalShell title="Сменить e-mail" onClose={onClose}>
      <input type="email" placeholder="new@ithona.tj" value={email} onChange={(e) => setEmail(e.target.value)} className={modalInput} autoComplete="email" />
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} loading={loading} disabled={loading}>Сохранить</Button>
        {msg && <span className={cn('text-caption', msg.ok ? 'text-ok-ink' : 'text-err-ink')}>{msg.text}</span>}
      </div>
    </ModalShell>
  )
}
