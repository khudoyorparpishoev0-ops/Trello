import { z } from 'zod'

/** `GET /api/v1/health` — liveness: процесс жив, зависимости не проверяются (§23.9). */
export const HealthResponse = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    uptimeS: z.number().int().nonnegative(),
  })
  .strict()

export type HealthResponse = z.infer<typeof HealthResponse>

/**
 * `GET /api/v1/health/ready` — readiness: PostgreSQL, Redis, MinIO.
 * Наружу только общий статус (200 `ok` / 503 `unavailable`), детали — в лог.
 */
export const ReadyResponse = z
  .object({
    status: z.enum(['ok', 'unavailable']),
  })
  .strict()

export type ReadyResponse = z.infer<typeof ReadyResponse>
