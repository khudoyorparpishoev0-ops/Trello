import { httpStatusOf, type ErrorCode, type ErrorEnvelope } from '@hona/shared'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

/**
 * Ошибки приложения и их отображение в конверт §9.2. 500 никогда не раскрывает
 * детали: в теле только код и requestId, причина — в логе.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }

  get statusCode(): number {
    return httpStatusOf(this.code)
  }
}

export interface MappedError {
  readonly statusCode: number
  readonly body: ErrorEnvelope
  /** 5xx логируются как error со стеком, 4xx — как info. */
  readonly internal: boolean
}

interface FastifyLikeError {
  code?: unknown
  statusCode?: unknown
}

function envelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return { error: { code, message, requestId, ...(details ? { details } : {}) } }
}

export function mapError(err: unknown, requestId: string): MappedError {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: envelope(err.code, err.message, requestId, err.details),
      internal: false,
    }
  }
  if (hasZodFastifySchemaValidationErrors(err)) {
    const issues = err.validation.map((issue) => ({
      path: issue.instancePath || '/',
      message: issue.message ?? 'invalid',
    }))
    return {
      statusCode: 400,
      body: envelope('VALIDATION_FAILED', 'Request validation failed', requestId, { issues }),
      internal: false,
    }
  }
  const fastifyError = (typeof err === 'object' && err !== null ? err : {}) as FastifyLikeError
  const status = typeof fastifyError.statusCode === 'number' ? fastifyError.statusCode : 500
  if (status === 413) {
    return {
      statusCode: 413,
      body: envelope('PAYLOAD_TOO_LARGE', 'Request body is too large', requestId),
      internal: false,
    }
  }
  if (status >= 400 && status < 500) {
    // Ошибки разбора тела и заголовков Fastify (битый JSON, неизвестный Content-Type).
    return {
      statusCode: 400,
      body: envelope('BAD_REQUEST', 'Malformed request', requestId),
      internal: false,
    }
  }
  return {
    statusCode: 500,
    body: envelope('INTERNAL_ERROR', 'Internal server error', requestId),
    internal: true,
  }
}
