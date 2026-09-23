import { ErrorEnvelope, HealthResponse, ReadyResponse } from '@hona/shared'
import type { z } from 'zod'

/**
 * Типизированный клиент API v2. Ответы проверяются теми же zod-схемами, что и на
 * сервере (packages/shared). Phase 1 — только чтение состояния системы.
 *
 * Правило, закрывающее дефекты v1: ошибка чтения — это ошибка, а не повод
 * подставить демо-данные или что-то записать на сервер.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface GetOptions<S extends z.ZodType> {
  schema: S
  /** Статусы, тело которых — валидный ответ по `schema` (например, 503 у readiness). */
  acceptStatuses?: readonly number[]
  signal?: AbortSignal
}

export async function apiGet<S extends z.ZodType>(
  path: string,
  { schema, acceptStatuses = [200], signal }: GetOptions<S>,
): Promise<z.infer<S>> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  })
  const body: unknown = await response.json().catch(() => null)
  if (acceptStatuses.includes(response.status)) {
    const parsed = schema.safeParse(body)
    if (parsed.success) return parsed.data
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Unexpected response shape', null)
  }
  const envelope = ErrorEnvelope.safeParse(body)
  if (envelope.success) {
    const { code, message, requestId } = envelope.data.error
    throw new ApiError(response.status, code, message, requestId)
  }
  throw new ApiError(response.status, 'HTTP_ERROR', `HTTP ${response.status}`, null)
}

export const systemApi = {
  health: (signal?: AbortSignal) =>
    apiGet('/api/v1/health', { schema: HealthResponse, ...(signal ? { signal } : {}) }),
  readiness: (signal?: AbortSignal) =>
    apiGet('/api/v1/health/ready', {
      schema: ReadyResponse,
      acceptStatuses: [200, 503],
      ...(signal ? { signal } : {}),
    }),
}
