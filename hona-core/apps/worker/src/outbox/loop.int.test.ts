import { type DbHandle, createDb } from '@hona/db'
import { appDb, truncateAll, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { insertEvent, outboxRows } from '../../test/fixtures.js'
import { memoryLogger } from '../../test/logger.js'
import { createNotificationListener } from '../listener.js'
import { createOutboxWorker } from './loop.js'

/** Цикл воркера: LISTEN будит сразу, опрос страхует, остановка дорабатывает пачку. */
let database: TestDatabase
let handle: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  handle = appDb(database, 'loop')
})
afterAll(async () => handle.close())
beforeEach(async () => truncateAll(database))

async function waitFor(check: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('outbox worker loop', () => {
  it('LISTEN/NOTIFY wakes the worker long before the poll interval', async () => {
    const { logger } = memoryLogger('silent')
    const worker = createOutboxWorker({
      db: handle.db,
      workerId: 'loop-w',
      handlers: { noop: async () => undefined },
      log: logger,
      pollIntervalMs: 60_000,
    })
    const listener = createNotificationListener({
      connectionString: database.appUrl,
      onNotify: () => worker.wake(),
      log: logger,
    })
    listener.start()
    await waitFor(async () => listener.isListening())
    worker.start()
    try {
      await waitFor(async () => worker.lastCycleAt() !== null)
      const started = Date.now()
      const id = await insertEvent(handle.db)
      await handle.pool.query("SELECT pg_notify('outbox_new', '')")
      await waitFor(async () =>
        (await outboxRows(handle.db)).some((r) => r.event_id === id && r.status === 'done'),
      )
      expect(Date.now() - started).toBeLessThan(5_000)
    } finally {
      await worker.stop()
      await listener.stop()
    }
  })

  it('polling alone delivers events when no NOTIFY arrives', async () => {
    const worker = createOutboxWorker({
      db: handle.db,
      workerId: 'poll-w',
      handlers: { noop: async () => undefined },
      log: memoryLogger('silent').logger,
      pollIntervalMs: 50,
    })
    worker.start()
    try {
      await insertEvent(handle.db)
      await waitFor(async () => (await outboxRows(handle.db)).every((r) => r.status === 'done'))
    } finally {
      await worker.stop()
    }
  })

  it('stop() lets the in-flight batch finish and claims nothing afterwards', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let started = 0
    const worker = createOutboxWorker({
      db: handle.db,
      workerId: 'stop-w',
      handlers: {
        noop: async () => {
          started += 1
          await gate
        },
      },
      log: memoryLogger('silent').logger,
      pollIntervalMs: 20,
    })
    await insertEvent(handle.db)
    worker.start()
    await waitFor(async () => started === 1)
    const stopping = worker.stop()
    await insertEvent(handle.db)
    release()
    await stopping
    const rows = await outboxRows(handle.db)
    expect(rows.map((row) => row.status).sort()).toEqual(['done', 'pending'])
  })

  it('backs off while the database is unreachable instead of spinning', async () => {
    const broken = createDb({
      connectionString: 'postgres://hona_app:x@127.0.0.1:1/hona',
      applicationName: 'broken',
      onPoolError: () => undefined,
      connectionTimeoutMillis: 200,
    })
    const { logger, lines } = memoryLogger('info')
    const worker = createOutboxWorker({
      db: broken.db,
      workerId: 'broken-w',
      handlers: {},
      log: logger,
      pollIntervalMs: 20,
    })
    worker.start()
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    await worker.stop()
    await broken.close()
    const failures = lines().filter((line) => line.msg === 'worker: cycle failed')
    // Лог — только первая ошибка серии; пауза растёт (20 → 40 → 80 … мс), а не 50 попыток в секунду.
    expect(failures).toHaveLength(1)
    expect(worker.lastCycleAt()).toBeNull()
  })
})
