import { z } from 'zod'

/**
 * Стабильные машинные коды ошибок API (§9.2) и их HTTP-статусы.
 *
 * Фронт переводит `code` сам, `message` — только fallback. Коды бизнес-правил
 * (TRANSITION_NOT_ALLOWED, DEPENDENCY_CYCLE, …) добавляются в фазах, где
 * появляются соответствующие правила.
 */
export const ERROR_HTTP_STATUS = {
  VALIDATION_FAILED: 400,
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  PRECONDITION_REQUIRED: 428,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const satisfies Record<string, number>

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS

export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as [ErrorCode, ...ErrorCode[]]

export function httpStatusOf(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code]
}

/** Конверт ошибки: `{ error: { code, message, details?, requestId } }`. */
export const ErrorEnvelope = z
  .object({
    error: z
      .object({
        code: z.enum(ERROR_CODES),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional(),
        requestId: z.string(),
      })
      .strict(),
  })
  .strict()

export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>
