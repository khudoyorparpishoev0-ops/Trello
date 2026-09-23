import { isValidRequestId } from '@hona/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { memoryLogger, unreachableConfig } from '../test/fixtures.js'
import { buildApp, type App, BODY_LIMIT_BYTES } from './app.js'
import { AppError } from './core/errors.js'

/**
 * API-уровень Phase 1 (§23.8) через app.inject(). Зависимости указывают на закрытые
 * порты: фабрика ничего не открывает, readiness честно видит отказ соединения.
 */
let app: App | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

async function makeApp(extra?: (app: App) => void) {
  const log = memoryLogger('debug')
  app = await buildApp(unreachableConfig(), { logger: log.logger, version: '9.9.9-test' })
  extra?.(app)
  await app.ready()
  return { app, lines: log.lines }
}

/** Тестовые маршруты-мутации: в Phase 1 их нет, а проверить глобальные правила нужно. */
function mutationRoutes(instance: App) {
  instance.post(
    '/api/v1/__test/echo',
    { schema: { body: z.object({ n: z.number().int() }).strict() } },
    async (request) => ({ n: request.body.n }),
  )
  instance.post('/api/v1/__test/boom', async () => {
    throw new Error('db password=hunter2 exploded')
  })
  instance.post('/api/v1/__test/conflict', async () => {
    throw new AppError('VERSION_CONFLICT', 'Stale version', { currentVersion: 2 })
  })
}

const ORIGIN = 'http://localhost:5173'

describe('GET /api/v1/health', () => {
  it('answers 200 without authentication and with the liveness contract', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ status: string; version: string; uptimeS: number }>()
    expect(body).toEqual({ status: 'ok', version: '9.9.9-test', uptimeS: expect.any(Number) })
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('sets the §14.3 security headers', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(res.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('x-request-id (§23.9)', () => {
  it('generates a ULID and returns it', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(isValidRequestId(res.headers['x-request-id'])).toBe(true)
  })

  it('accepts a valid incoming id', async () => {
    const { app } = await makeApp()
    const incoming = '0190c2b4-5a6b-7c8d-9e0f-a1b2c3d4e5f6'
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': incoming },
    })
    expect(res.headers['x-request-id']).toBe(incoming)
  })

  it('replaces an invalid incoming id', async () => {
    const { app, lines } = await makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/nope',
      headers: { 'x-request-id': 'evil\ninjected log line' },
    })
    const id = res.headers['x-request-id']
    expect(isValidRequestId(id)).toBe(true)
    expect(id).not.toContain('evil')
    expect(JSON.stringify(lines())).not.toContain('injected log line')
  })
})

describe('error envelope (§9.2)', () => {
  it('unknown route → 404 NOT_FOUND with the same requestId as the header', async () => {
    const { app } = await makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: res.headers['x-request-id'],
      },
    })
  })

  it('invalid body → 400 VALIDATION_FAILED with issues', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { origin: ORIGIN },
      payload: { n: 'not a number', extra: 1 },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json<{ error: { code: string; details: { issues: unknown[] } } }>()
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.details.issues.length).toBeGreaterThan(0)
  })

  it('malformed JSON → 400 BAD_REQUEST', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      payload: '{"n": ',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('BAD_REQUEST')
  })

  it('AppError keeps its code, status and details', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/conflict',
      headers: { origin: ORIGIN },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { code: 'VERSION_CONFLICT', details: { currentVersion: 2 } },
    })
  })

  it('unexpected error → 500 with only the requestId; the cause goes to the log', async () => {
    const { app, lines } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/boom',
      headers: { origin: ORIGIN },
    })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: res.headers['x-request-id'],
      },
    })
    expect(res.body).not.toContain('hunter2')
    expect(res.body).not.toContain('stack')
    const logged = lines().find((line) => line.msg === 'request failed')
    expect(logged?.requestId).toBe(res.headers['x-request-id'])
  })
})

describe('body limit (§9.2)', () => {
  it('rejects bodies over 1 MB with 413', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify({ n: 1, pad: 'x'.repeat(BODY_LIMIT_BYTES) }),
    })
    expect(res.statusCode).toBe(413)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('CSRF: Origin check on mutations (§14.3)', () => {
  it('foreign Origin → 403 FORBIDDEN_ORIGIN before the handler runs', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { origin: 'https://evil.example' },
      payload: { n: 1 },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json<{ error: { code: string } }>().error.code).toBe('FORBIDDEN_ORIGIN')
  })

  it('missing Origin without Sec-Fetch-Site: same-origin → 403', async () => {
    const { app } = await makeApp(mutationRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/v1/__test/echo', payload: { n: 1 } })
    expect(res.statusCode).toBe(403)
    const crossSite = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { 'sec-fetch-site': 'cross-site' },
      payload: { n: 1 },
    })
    expect(crossSite.statusCode).toBe(403)
  })

  it('APP_ORIGIN or Sec-Fetch-Site: same-origin is allowed', async () => {
    const { app } = await makeApp(mutationRoutes)
    const withOrigin = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { origin: ORIGIN },
      payload: { n: 7 },
    })
    expect(withOrigin.statusCode).toBe(200)
    expect(withOrigin.json()).toEqual({ n: 7 })
    const sameOrigin = await app.inject({
      method: 'POST',
      url: '/api/v1/__test/echo',
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: { n: 8 },
    })
    expect(sameOrigin.statusCode).toBe(200)
  })

  it('GET, HEAD and OPTIONS are never blocked by the Origin check', async () => {
    const { app } = await makeApp()
    for (const method of ['GET', 'HEAD'] as const) {
      const res = await app.inject({
        method,
        url: '/api/v1/health',
        headers: { origin: 'https://evil.example' },
      })
      expect(res.statusCode).toBe(200)
    }
    const options = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    })
    expect(options.statusCode).not.toBe(403)
  })
})

describe('GET /api/v1/health/ready with unreachable dependencies', () => {
  it('answers 503 with only the aggregate status and logs the details', async () => {
    const { app, lines } = await makeApp()
    const started = Date.now()
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/ready' })
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'unavailable' })
    expect(res.body).not.toMatch(/postgres|redis|s3|ECONNREFUSED/i)
    const logged = lines().find((line) => line.msg === 'readiness: dependency unavailable') as
      { checks: Record<string, { ok: boolean }> } | undefined
    expect(logged?.checks.postgres?.ok).toBe(false)
    expect(logged?.checks.redis?.ok).toBe(false)
    expect(logged?.checks.s3?.ok).toBe(false)
    expect(JSON.stringify(logged)).not.toContain('test-only-pw')
  })
})

describe('OpenAPI (§9.1)', () => {
  it('documents exactly the Phase 1 endpoints', async () => {
    const { app } = await makeApp()
    const doc = app.swagger() as { openapi: string; paths: Record<string, unknown> }
    expect(doc.openapi).toBe('3.1.0')
    expect(Object.keys(doc.paths).sort()).toEqual(['/api/v1/health', '/api/v1/health/ready'])
  })
})
