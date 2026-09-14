/**
 * Доступ к AI-сервису (архитектура AI, слой 4).
 *
 * Ключ провайдера живёт только на сервере. Браузер отправляет идентификатор
 * агента и подготовленный датасет — подсказку собирает сервер по своему
 * реестру. Так же работает и сводка руководителя.
 */
import type { AgentId, AgentReport, ExecutivePicks, Finding } from './types'

export interface AiStatus {
  /** Провайдер настроен и готов отвечать. */
  enabled: boolean
  /** Модель, которая отвечает. Пусто, если AI выключен. */
  model?: string
  /** Почему выключен — показывается в интерфейсе как есть. */
  reason?: string
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.error ? String(detail.error) : `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

/** Доступен ли AI. Ответ «нет» — обычное состояние, а не ошибка. */
export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch('/api/ai/status', { credentials: 'include' })
    if (!res.ok) return { enabled: false, reason: 'Сервис недоступен' }
    return (await res.json()) as AiStatus
  } catch {
    return { enabled: false, reason: 'Сервер не отвечает' }
  }
}

/** Запустить одного доменного агента на его датасете. */
export function runAgent(agent: AgentId, dataset: unknown): Promise<AgentReport> {
  return post<AgentReport>('/api/ai/agent', { agent, dataset })
}

/**
 * Сводка руководителя. На вход идут только проверенные выводы агентов —
 * ни доски, ни карточек, ни сырых данных.
 */
export function runExecutive(findings: Finding[]): Promise<ExecutivePicks> {
  return post<ExecutivePicks>('/api/ai/executive', { findings })
}
