import { workerDatabase } from '@hona/db/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryLogger } from '../../../test/fixtures.js'
import { integrationConfig } from '../../../test/integration.js'
import { startTcpProxy } from '../../../test/tcp-proxy.js'
import { buildApp, type App } from '../../app.js'

/**
 * Readiness против настоящих PostgreSQL, Redis и MinIO (§23.9, §23.11 п.3).
 * «PostgreSQL остановлен» моделируется адресом без сервера; полная остановка
 * контейнера проверяется в Docker-приёмке (docs/development.md).
 */
let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

async function ready(config: ReturnType<typeof integrationConfig>) {
  app = await buildApp(config, { logger: memoryLogger('silent').logger, version: 'it' })
  await app.ready()
  return app.inject({ method: 'GET', url: '/api/v1/health/ready' })
}

describe('GET /api/v1/health/ready (real dependencies)', () => {
  it('200 ok when PostgreSQL, Redis and MinIO are reachable', async () => {
    const db = await workerDatabase()
    const res = await ready(integrationConfig(db.appUrl))
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('503 when PostgreSQL is unavailable, even though Redis and MinIO are up', async () => {
    const db = await workerDatabase()
    const down = new URL(db.appUrl)
    down.port = '1'
    const res = await ready(integrationConfig(down.toString()))
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'unavailable' })
  })

  it('503 when the credentials are wrong — readiness does not hide dependency failures', async () => {
    const db = await workerDatabase()
    const wrong = new URL(db.appUrl)
    wrong.password = 'definitely-wrong'
    const res = await ready(integrationConfig(wrong.toString()))
    expect(res.statusCode).toBe(503)
  })

  it('503 when the bucket does not exist', async () => {
    const db = await workerDatabase()
    const base = integrationConfig(db.appUrl)
    const res = await ready({ ...base, s3: { ...base.s3, bucket: 'hona-missing-bucket' } })
    expect(res.statusCode).toBe(503)
  })

  it('the same process goes 200 → 503 while PostgreSQL is down → 200 after it returns', async () => {
    const db = await workerDatabase()
    const target = new URL(db.appUrl)
    const proxy = await startTcpProxy(target.hostname, Number(target.port))
    try {
      const viaProxy = new URL(db.appUrl)
      viaProxy.hostname = '127.0.0.1'
      viaProxy.port = String(proxy.port)
      app = await buildApp(integrationConfig(viaProxy.toString()), {
        logger: memoryLogger('silent').logger,
        version: 'it',
      })
      await app.ready()
      const probe = () => app!.inject({ method: 'GET', url: '/api/v1/health/ready' })

      expect((await probe()).statusCode).toBe(200)
      await proxy.down()
      const whileDown = await probe()
      expect(whileDown.statusCode).toBe(503)
      expect(whileDown.json()).toEqual({ status: 'unavailable' })
      await proxy.up()
      expect((await probe()).statusCode).toBe(200)
    } finally {
      await proxy.close()
    }
  })
})
