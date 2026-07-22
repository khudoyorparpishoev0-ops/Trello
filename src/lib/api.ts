import type { BoardState } from '@/types'

/**
 * Клиент API доски. Тот же origin (Caddy проксирует /api → сервис api).
 * Все методы «мягкие»: при недоступности бэкенда возвращают null/false,
 * чтобы приложение продолжало работать в локальном режиме, а не падало.
 */

const BASE = '/api'

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
