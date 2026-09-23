import { domainEvents, outboxDeadLetter, type DbHandle } from '@hona/db'
import { appDb, truncateAll, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { systemContext } from '../../apps/api/src/core/context.js'
import { emit } from '../../apps/api/src/core/events/emit.js'
import { newId } from '../../apps/api/src/core/ids.js'
import { createLogger as createApiLogger } from '../../apps/api/src/core/logger.js'
import { withTransaction } from '../../apps/api/src/core/tx.js'
import { HANDLERS } from '../../apps/worker/src/handlers/index.js'
import { createNotificationListener } from '../../apps/worker/src/listener.js'
import { createLogger as createWorkerLogger } from '../../apps/worker/src/logger.js'
import { createOutboxWorker } from '../../apps/worker/src/outbox/loop.js'
import { MAX_ATTEMPTS } from '../../apps/worker/src/outbox/retry.js'

/**
 * Приёмка Phase 1 (§23.11 п.4): настоящий emit() в транзакции API →
 * domain_events → outbox → LISTEN/NOTIFY → воркер → noop-обработчик.
 * Системный тест собирает оба приложения, поэтому живёт вне apps/*.
 */
let database: TestDatabase
let api: DbHandle
let worker: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  api = appDb(database, 'hona-api')
  worker = appDb(database, 'hona-worker')
})
afterAll(async () => {
  await api.close()
  await worker.close()
})
beforeEach(async () => truncateAll(database))

const silent = { level: 'silent' }

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

async function ping(note: string): Promise<string> {
  const ctx = systemContext({
    requestId: '01J8Z3K4M5N6P7Q8R9S0T1V2W3',
    log: createApiLogger({ ...silent, service: 'api' }),
  })
  return withTransaction(api.db, (tx) =>
    emit(tx, ctx, 'system.ping', { type: 'system', id: newId() }, { note }),
  )
}

async function status(eventId: string) {
  const rows = await api.db.execute<{ handler: string; status: string; attempts: number }>(
    sql`SELECT handler, status, attempts FROM outbox WHERE event_id = ${eventId}`,
  )
  return rows.rows
}

describe('system.ping end to end', () => {
  it('travels emit → domain_events → outbox → worker → noop → done', async () => {
    const log = createWorkerLogger(silent)
    const loop = createOutboxWorker({
      db: worker.db,
      workerId: 'e2e',
      handlers: HANDLERS,
      log,
      pollIntervalMs: 60_000,
    })
    const listener = createNotificationListener({
      connectionString: database.appUrl,
      onNotify: () => loop.wake(),
      log,
    })
    listener.start()
    await waitFor(async () => listener.isListening())
    loop.start()
    try {
      const eventId = await ping('e2e acceptance')
      await waitFor(async () => (await status(eventId)).every((row) => row.status === 'done'))
      expect(await status(eventId)).toEqual([{ handler: 'noop', status: 'done', attempts: 1 }])
      const [event] = await api.db.select().from(domainEvents)
      expect(event).toMatchObject({
        id: eventId,
        type: 'system.ping',
        actorKind: 'system',
        payload: { note: 'e2e acceptance' },
      })
    } finally {
      await loop.stop()
      await listener.stop()
    }
  })

  it('a handler that keeps failing ends in dead-letter after 12 attempts; the event stays auditable', async () => {
    const log = createWorkerLogger(silent)
    const failing = createOutboxWorker({
      db: worker.db,
      workerId: 'e2e-failing',
      handlers: { noop: async () => Promise.reject(new Error('downstream unavailable')) },
      log,
    })
    const eventId = await ping('will fail')
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const results = await failing.runOnce()
      expect(results).toEqual([attempt < MAX_ATTEMPTS ? 'retry' : 'dead_letter'])
      await worker.db.execute(
        sql`UPDATE outbox SET next_attempt_at = now() WHERE status = 'pending'`,
      )
    }
    expect(await status(eventId)).toEqual([])
    const dead = await api.db.select().from(outboxDeadLetter)
    expect(dead).toEqual([
      expect.objectContaining({
        eventId,
        handler: 'noop',
        attempts: 12,
        lastError: 'Error: downstream unavailable',
      }),
    ])
    expect(await api.db.select().from(domainEvents)).toHaveLength(1)
  })
})
