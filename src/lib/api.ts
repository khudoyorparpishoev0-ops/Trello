import type { BoardState } from '@/types'

/**
 * Клиент API доски. Тот же origin (Caddy проксирует /api → сервис api).
 * Все методы «мягкие»: при недоступности бэкенда возвращают null/false,
 * чтобы приложение продолжало работать в локальном режиме, а не падало.
 */

const BASE = '/api'

export interface AuthInfo {
  /** Требуется ли вход (задан ли пароль на сервере). */
  authRequired: boolean
  /** Выполнен ли вход. */
  authenticated: boolean
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

/** Вход. Возвращает true при успехе. */
export async function login(loginName: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginName, password }),
    })
    return res.ok
  } catch {
    return false
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
