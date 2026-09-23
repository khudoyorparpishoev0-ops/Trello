import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ERROR_HTTP_STATUS, ErrorEnvelope, httpStatusOf } from './errors.js'

describe('error codes → HTTP status (§9.2)', () => {
  it.each([
    ['VALIDATION_FAILED', 400],
    ['BAD_REQUEST', 400],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['FORBIDDEN_ORIGIN', 403],
    ['NOT_FOUND', 404],
    ['VERSION_CONFLICT', 409],
    ['CONFLICT', 409],
    ['PAYLOAD_TOO_LARGE', 413],
    ['PRECONDITION_REQUIRED', 428],
    ['RATE_LIMITED', 429],
    ['INTERNAL_ERROR', 500],
  ] as const)('%s → %d', (code, status) => {
    expect(httpStatusOf(code)).toBe(status)
  })

  it('covers every declared code and only statuses from the architecture table', () => {
    expect(ERROR_CODES).toHaveLength(Object.keys(ERROR_HTTP_STATUS).length)
    const allowed = new Set([400, 401, 403, 404, 409, 413, 422, 428, 429, 500])
    for (const code of ERROR_CODES) expect(allowed.has(httpStatusOf(code))).toBe(true)
  })
})

describe('ErrorEnvelope', () => {
  it('accepts the §9.2 shape', () => {
    const value = {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: '01J8ABCDEFGHJKMNPQRSTVWXYZ',
      },
    }
    expect(ErrorEnvelope.parse(value)).toEqual(value)
  })

  it('rejects unknown codes and extra fields', () => {
    expect(
      ErrorEnvelope.safeParse({ error: { code: 'NOPE', message: 'x', requestId: 'r' } }).success,
    ).toBe(false)
    expect(
      ErrorEnvelope.safeParse({
        error: { code: 'NOT_FOUND', message: 'x', requestId: 'r', stack: 'leak' },
      }).success,
    ).toBe(false)
  })
})
