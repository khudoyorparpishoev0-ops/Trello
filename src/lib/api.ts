import type { AppData, BoardState } from '@/types'

/**
 * Клиент API доски. Тот же origin (Caddy проксирует /api → сервис api).
 * Все методы «мягкие»: при недоступности бэкенда возвращают null/false,
 * чтобы приложение продолжало работать в локальном режиме, а не падало.
 */

const BASE = '/api'

export interface AuthUser {
  id?: string
  login?: string
  name: string
  initials: string
  color: string
  role: string
  department?: string
  birthday?: string
  email?: string
  position?: string
  /** Фото профиля (data-URL) либо пусто. */
  avatar?: string
  shared?: boolean
}

export interface AuthInfo {
  /** Требуется ли вход. */
  authRequired: boolean
  /** Включён ли режим личных аккаунтов (регистрация по коду). */
  accountsEnabled: boolean
  /** true — код подтверждения приходит на рабочую почту; false — код от администратора. */
  emailVerification?: boolean
  /** Домены, с которых разрешена регистрация (для подсказки в форме). */
  emailDomains?: string[]
  /** Выполнен ли вход. */
  authenticated: boolean
  /** Текущий пользователь (если вошёл). */
  user: AuthUser | null
}

export interface AuthResult {
  ok: boolean
  error?: string
  user?: AuthUser
}

/** Статус аутентификации. null — бэкенд недоступен (тогда работаем как раньше). */
export async function getAuth(): Promise<AuthInfo | null> {
  try {
    const res = await fetch(`${BASE}/auth/me`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as AuthInfo
  } catch {
    return null
  }
}

/** Вход по логину/паролю. */
export async function login(loginName: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginName, password }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error, user: data?.user }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Запросить код подтверждения на рабочую почту. */
export async function requestRegistrationCode(email: string): Promise<{ ok: boolean; error?: string; retryAfter?: number }> {
  try {
    const res = await fetch(`${BASE}/auth/register/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error, retryAfter: data?.retryAfter }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Регистрация по коду-приглашению. */
export async function register(input: {
  name: string
  login: string
  password: string
  code: string
  department: string
  birthday: string
  email: string
  position: string
}): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error, user: data?.user }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Сброс пароля сотрудника (только админ). */
export async function resetPassword(userId: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE}/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Сменить свой пароль (нужен текущий). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Обновить свой профиль. Возвращает обновлённого пользователя. */
export async function updateProfile(input: {
  name: string
  email: string
  department: string
  position: string
  birthday: string
}): Promise<AuthResult> {
  try {
    const res = await fetch(`${BASE}/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error, user: data?.user }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Загрузить (data-URL) или удалить (пустая строка) фото профиля. */
export async function updateAvatar(avatar: string): Promise<{ ok: boolean; error?: string; avatar?: string }> {
  try {
    const res = await fetch(`${BASE}/auth/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: data?.error, avatar: data?.avatar }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** Список команды (для раздела «Команда» и дней рождения). */
export async function fetchUsers(): Promise<AuthUser[]> {
  try {
    const res = await fetch(`${BASE}/users`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.users) ? (data.users as AuthUser[]) : []
  } catch {
    return []
  }
}

/** Выход. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/auth/logout`, { method: 'POST' })
  } catch {
    /* ignore */
  }
}

export interface TelegramStatus {
  /** Включён ли бот на сервере (задан ли токен). */
  enabled: boolean
  /** Привязан ли Telegram у текущего пользователя. */
  linked: boolean
  /** Имя бота (@username) — для ссылки. */
  botUsername: string
}

/** Статус подключения Telegram у текущего пользователя. */
export async function telegramStatus(): Promise<TelegramStatus | null> {
  try {
    const res = await fetch(`${BASE}/telegram/status`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as TelegramStatus
  } catch {
    return null
  }
}

export interface TelegramLink {
  code: string
  botUsername: string
  deepLink: string
}

/** Получить код и ссылку для привязки Telegram. */
export async function telegramLink(): Promise<TelegramLink | null> {
  try {
    const res = await fetch(`${BASE}/telegram/link`, { method: 'POST' })
    if (!res.ok) return null
    return (await res.json()) as TelegramLink
  } catch {
    return null
  }
}

/** Отвязать Telegram. */
export async function telegramUnlink(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/telegram/unlink`, { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Загрузить состояние с сервера (новый формат AppData или старый BoardState —
 * миграцию делает store). null — если данных нет или бэкенд недоступен.
 */
export async function loadBoard(): Promise<AppData | BoardState | null> {
  try {
    const res = await fetch(`${BASE}/board`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.lists && data.cards && (data.boards || data.board)) return data
    return null
  } catch {
    return null
  }
}

/** Сохранить состояние на сервер. true — успех. */
export async function saveBoard(state: AppData): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/board`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    return res.ok
  } catch {
    return false
  }
}
