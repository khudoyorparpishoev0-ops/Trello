import { afterEach, describe, expect, it } from 'vitest'
import {
  isWorkerHealthy,
  MAX_CYCLE_AGE_MS,
  startHealthServer,
  type HealthServer,
} from './health.js'

describe('isWorkerHealthy (§23.9)', () => {
  const now = 1_000_000
  const ok = async () => undefined
  const down = async () => {
    throw new Error('connection refused')
  }

  it('healthy when the last cycle is fresh and PostgreSQL answers', async () => {
    expect(
      await isWorkerHealthy({ lastCycleAt: () => now - 1_000, pingDatabase: ok, now: () => now }),
    ).toBe(true)
  })

  it('unhealthy before the first cycle, after a stale cycle or when PostgreSQL is down', async () => {
    expect(
      await isWorkerHealthy({ lastCycleAt: () => null, pingDatabase: ok, now: () => now }),
    ).toBe(false)
    expect(
      await isWorkerHealthy({
        lastCycleAt: () => now - MAX_CYCLE_AGE_MS - 1,
        pingDatabase: ok,
        now: () => now,
      }),
    ).toBe(false)
    expect(
      await isWorkerHealthy({ lastCycleAt: () => now, pingDatabase: down, now: () => now }),
    ).toBe(false)
  })
})

describe('worker health server', () => {
  let server: HealthServer | undefined
  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  it('serves 200 / 503 / 404 with JSON bodies only', async () => {
    let healthy = true
    server = await startHealthServer({
      host: '127.0.0.1',
      port: 0,
      deps: {
        lastCycleAt: () => (healthy ? Date.now() : null),
        pingDatabase: async () => undefined,
      },
    })
    const base = `http://127.0.0.1:${server.port}`
    const up = await fetch(`${base}/health`)
    expect(up.status).toBe(200)
    expect(await up.json()).toEqual({ status: 'ok' })
    healthy = false
    const down = await fetch(`${base}/health`)
    expect(down.status).toBe(503)
    expect(await down.json()).toEqual({ status: 'unavailable' })
    expect((await fetch(`${base}/other`)).status).toBe(404)
    expect((await fetch(`${base}/health`, { method: 'POST' })).status).toBe(404)
  })
})
