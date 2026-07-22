import type { BoardState } from '@/types'

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
  shared?: boolean
}

export interface AuthInfo {
  /** Требуется ли вход. */
  authRequired: boolean
  /** Включён ли режим личных аккаунтов (регистрация по коду). */
  accountsEnabled: boolean
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

/** Регистрация по коду-приглашению. */
export async function register(input: {
  name: string
  login: string
  password: string
  code: string
  department: string
  birthday: string
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

/** Загрузить доску с сервера. null — если данных нет или бэкенд недоступен. */
export async function loadBoard(): Promise<BoardState | null> {
  try {
    const res = await fetch(`${BASE}/board`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as BoardState | null
    // Считаем валидным только если это похоже на состояние доски.
    if (data && data.board && data.lists && data.cards) return data
    return null
  } catch {
    return null
  }
}

/** Сохранить доску на сервер. true — успех. */
export async function saveBoard(state: BoardState): Promise<boolean> {
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
