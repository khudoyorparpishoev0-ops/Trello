import { domainEvents, type DbHandle } from '@hona/db'
import { appDb, truncateAll, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deadLetterRows, insertEvent, makeAllDue, outboxRows } from '../../test/fixtures.js'
import { memoryLogger } from '../../test/logger.js'
import { claimBatch } from './claim.js'
import { dispatchBatch, type DispatchDeps } from './dispatch.js'
import { MAX_ATTEMPTS } from './retry.js'
import type { HandlerRegistry } from './types.js'

/** §10.5: успех, повтор с backoff, dead-letter на 12-й попытке, изоляция обработчиков. */
let database: TestDatabase
let handle: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  handle = appDb(database, 'dispatch')
})
afterAll(async () => handle.close())
beforeEach(async () => truncateAll(database))

function deps(handlers: HandlerRegistry, extra: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    db: handle.db,
    workerId: 'w1',
    handlers,
    log: memoryLogger('silent').logger,
    random: () => 0.5,
    ...extra,
  }
}

async function cycle(d: DispatchDeps) {
  return dispatchBatch(d, await claimBatch(handle.db, d.workerId))
}

describe('dispatchBatch', () => {
  it('success → status done, processed_at set, lock released; event stays in the journal', async () => {
    const seen: string[] = []
    const id = await insertEvent(handle.db)
    expect(await cycle(deps({ noop: async (event) => void seen.push(event.type) }))).toEqual([
      'done',
    ])
    expect(seen).toEqual(['system.ping'])
    const rows = await handle.db.execute<{
      status: string
      processed: boolean
      locked_by: string | null
    }>(
      sql`SELECT status, processed_at IS NOT NULL AS processed, locked_by FROM outbox WHERE event_id = ${id}`,
    )
    expect(rows.rows).toEqual([{ status: 'done', processed: true, locked_by: null }])
    expect(await handle.db.select().from(domainEvents)).toHaveLength(1)
  })

  it('failure → back to pending with attempts, last_error and a backoff delay; no hot loop', async () => {
    await insertEvent(handle.db)
    const failing = deps({ noop: async () => Promise.reject(new Error('telegram is down')) })
    expect(await cycle(failing)).toEqual(['retry'])
    const [row] = await outboxRows(handle.db)
    expect(row).toMatchObject({
      status: 'pending',
      attempts: 1,
      locked_by: null,
      last_error: 'Error: telegram is down',
    })
    expect(row!.delay_s).toBeGreaterThan(3)
    expect(row!.delay_s).toBeLessThanOrEqual(5)
    // Не наступило время повтора — строка не захватывается снова.
    expect(await cycle(failing)).toEqual([])
  })

  it('keeps retrying and moves the row to dead-letter on the 12th failed attempt', async () => {
    const id = await insertEvent(handle.db)
    let calls = 0
    const failing = deps({
      noop: async () => {
        calls += 1
        throw new Error(`attempt ${calls} failed`)
      },
    })
    const results: string[] = []
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      results.push(...(await cycle(failing)))
      await makeAllDue(handle.db)
    }
    expect(results).toEqual([...Array<string>(MAX_ATTEMPTS - 1).fill('retry'), 'dead_letter'])
    expect(calls).toBe(12)
    expect(await outboxRows(handle.db)).toEqual([])
    expect(await deadLetterRows(handle.db)).toEqual([
      { event_id: id, handler: 'noop', attempts: 12, last_error: 'Error: attempt 12 failed' },
    ])
    // Исходное событие остаётся для аудита.
    expect(await handle.db.select().from(domainEvents)).toHaveLength(1)
    expect(await cycle(failing)).toEqual([])
  })

  it('one failing handler does not delay or repeat another handler of the same event', async () => {
    await insertEvent(handle.db, ['noop', 'flaky'])
    let noopCalls = 0
    const handlers: HandlerRegistry = {
      noop: async () => void (noopCalls += 1),
      flaky: async () => Promise.reject(new Error('flaky failed')),
    }
    const results = await cycle(deps(handlers))
    expect(results.sort()).toEqual(['done', 'retry'])
    await makeAllDue(handle.db)
    expect(await cycle(deps(handlers))).toEqual(['retry'])
    expect(noopCalls).toBe(1)
    const rows = await outboxRows(handle.db)
    expect(rows.map((row) => [row.handler, row.status, row.attempts])).toEqual([
      ['flaky', 'pending', 2],
      ['noop', 'done', 1],
    ])
  })

  it('an unregistered handler is a failure that is retried, never silently dropped', async () => {
    await insertEvent(handle.db, ['ghost'])
    expect(await cycle(deps({}))).toEqual(['retry'])
    const [row] = await outboxRows(handle.db)
    expect(row?.last_error).toContain('no handler registered for "ghost"')
  })

  it('a hanging handler times out and is retried', async () => {
    await insertEvent(handle.db)
    const results = await cycle(
      deps({ noop: () => new Promise<void>(() => undefined) }, { handlerTimeoutMs: 50 }),
    )
    expect(results).toEqual(['retry'])
    expect((await outboxRows(handle.db))[0]?.last_error).toContain('timed out')
  })

  it('a worker whose lease was taken over does not overwrite the new owner', async () => {
    await insertEvent(handle.db)
    const claimed = await claimBatch(handle.db, 'w1')
    // Свип вернул строку, её захватил другой воркер.
    await handle.db.execute(sql`UPDATE outbox SET locked_by = 'w2'`)
    const results = await dispatchBatch(deps({ noop: async () => undefined }), claimed)
    expect(results).toEqual(['lease_lost'])
    expect((await outboxRows(handle.db))[0]).toMatchObject({
      status: 'processing',
      locked_by: 'w2',
    })
  })

  it('truncates very long errors stored in last_error', async () => {
    await insertEvent(handle.db)
    await cycle(deps({ noop: async () => Promise.reject(new Error('x'.repeat(10_000))) }))
    expect((await outboxRows(handle.db))[0]?.last_error?.length).toBeLessThanOrEqual(2_000)
  })
})
