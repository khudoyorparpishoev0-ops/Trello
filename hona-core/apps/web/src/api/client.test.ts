import { HealthResponse } from '@hona/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, systemApi } from './client'

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    ),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('apiGet', () => {
  it('validates successful responses with the shared contract', async () => {
    respond(200, { status: 'ok', version: '1', uptimeS: 3 })
    await expect(apiGet('/api/v1/health', { schema: HealthResponse })).resolves.toEqual({
      status: 'ok',
      version: '1',
      uptimeS: 3,
    })
  })

  it('rejects responses that do not match the contract', async () => {
    respond(200, { status: 'ok', version: '1', uptimeS: 3, leaked: 'x' })
    await expect(apiGet('/api/v1/health', { schema: HealthResponse })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('turns the §9.2 envelope into ApiError with code and requestId', async () => {
    respond(404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: 'r-1' } })
    const error = await apiGet('/api/v1/x', { schema: HealthResponse }).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', requestId: 'r-1' })
  })

  it('reports non-JSON failures as HTTP_ERROR', async () => {
    respond(502, '<html>bad gateway</html>')
    await expect(apiGet('/api/v1/x', { schema: HealthResponse })).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
    })
  })

  it('readiness treats 503 as a valid answer', async () => {
    respond(503, { status: 'unavailable' })
    await expect(systemApi.readiness()).resolves.toEqual({ status: 'unavailable' })
  })

  it('sends GET with same-origin credentials only', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await systemApi.readiness()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health/ready', {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    })
  })
})
