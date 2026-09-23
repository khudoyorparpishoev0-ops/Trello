import { type DbHandle } from '@hona/db'
import { appDb, truncateAll, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deadLetterRows, insertEvent, outboxRows } from '../../test/fixtures.js'
import { claimBatch } from './claim.js'
import { purgeDone, reclaimStuck, sweep } from './sweeper.js'

/** Восстановление после падения воркера и очистка done (§10.5, §21.3). */
let database: TestDatabase
let handle: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  handle = appDb(database, 'sweeper')
})
afterAll(async () => handle.close())
beforeEach(async () => truncateAll(database))

describe('reclaimStuck', () => {
  it('returns rows stuck in processing for more than 5 minutes to pending', async () => {
    await insertEvent(handle.db)
    await insertEvent(handle.db)
    await claimBatch(handle.db, 'crashed-worker')
    // Одна строка «зависла» 6 минут назад, другая только что захвачена.
    await handle.db.execute(sql`
      UPDATE outbox SET locked_at = now() - interval '6 minutes'
       WHERE event_id = (SELECT event_id FROM outbox ORDER BY created_at LIMIT 1)`)
    expect(await reclaimStuck(handle.db)).toEqual({ reclaimed: 1, deadLettered: 0 })
    const rows = await outboxRows(handle.db)
    expect(rows.map((row) => [row.status, row.locked_by])).toEqual([
      ['pending', null],
      ['processing', 'crashed-worker'],
    ])
    expect(rows[0]?.last_error).toContain('lease expired')
    // Возвращённую строку снова можно захватить; attempts продолжает расти.
    const again = await claimBatch(handle.db, 'healthy-worker')
    expect(again).toEqual([expect.objectContaining({ attempts: 2 })])
  })

  it('does not return a row whose attempts are exhausted; it goes to dead-letter instead', async () => {
    const id = await insertEvent(handle.db)
    await handle.db.execute(sql`
      UPDATE outbox SET status = 'processing', attempts = 12, locked_by = 'w',
                        locked_at = now() - interval '10 minutes'`)
    expect(await reclaimStuck(handle.db)).toEqual({ reclaimed: 0, deadLettered: 1 })
    expect(await outboxRows(handle.db)).toEqual([])
    expect(await deadLetterRows(handle.db)).toEqual([
      expect.objectContaining({
        event_id: id,
        attempts: 12,
        last_error: expect.stringContaining('lease expired'),
      }),
    ])
  })
})

describe('purgeDone', () => {
  it('deletes done rows older than 24 hours in bounded batches and keeps the rest', async () => {
    for (let i = 0; i < 5; i += 1) await insertEvent(handle.db)
    await handle.db.execute(
      sql`UPDATE outbox SET status = 'done', processed_at = now() - interval '25 hours'`,
    )
    await insertEvent(handle.db)
    await handle.db.execute(sql`
      UPDATE outbox SET status = 'done', processed_at = now() - interval '1 hour'
       WHERE processed_at IS NULL`)
    expect(await purgeDone(handle.db, undefined, 3)).toBe(3)
    expect(await purgeDone(handle.db)).toBe(2)
    expect(await purgeDone(handle.db)).toBe(0)
    expect(await outboxRows(handle.db)).toHaveLength(1)
  })

  it('sweep() combines both and never touches pending rows', async () => {
    await insertEvent(handle.db)
    expect(await sweep(handle.db)).toEqual({ reclaimed: 0, deadLettered: 0, purged: 0 })
    expect((await outboxRows(handle.db))[0]?.status).toBe('pending')
  })
})
