import { describe, expect, it } from 'vitest'
import { AppError, mapError } from './errors.js'

describe('mapError (§9.2)', () => {
  it('maps AppError to its code and status', () => {
    const mapped = mapError(
      new AppError('VERSION_CONFLICT', 'stale', { currentVersion: 3 }),
      'req-1',
    )
    expect(mapped).toEqual({
      statusCode: 409,
      internal: false,
      body: {
        error: {
          code: 'VERSION_CONFLICT',
          message: 'stale',
          details: { currentVersion: 3 },
          requestId: 'req-1',
        },
      },
    })
  })

  it('maps oversized bodies to 413 PAYLOAD_TOO_LARGE', () => {
    const mapped = mapError(Object.assign(new Error('too big'), { statusCode: 413 }), 'r')
    expect(mapped.statusCode).toBe(413)
    expect(mapped.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('maps other client errors from Fastify to a generic 400', () => {
    const mapped = mapError(
      Object.assign(new SyntaxError('Unexpected token } in JSON at position 7'), {
        statusCode: 400,
      }),
      'r',
    )
    expect(mapped.statusCode).toBe(400)
    expect(mapped.body.error).toEqual({
      code: 'BAD_REQUEST',
      message: 'Malformed request',
      requestId: 'r',
    })
  })

  it('hides everything about unexpected errors', () => {
    const mapped = mapError(
      new Error('connect ECONNREFUSED; password=hunter2; SELECT * FROM users'),
      'r9',
    )
    expect(mapped).toEqual({
      statusCode: 500,
      internal: true,
      body: {
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: 'r9' },
      },
    })
    expect(mapError('a string', 'r').statusCode).toBe(500)
    expect(mapError(null, 'r').statusCode).toBe(500)
  })
})
