import { appDb, truncateAll, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { type DbHandle } from '@hona/db'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { insertEvent, outboxRows } from '../../test/fixtures.js'
import { claimBatch } from './claim.js'

/** §10.5, §15.2 Concurrency: две параллельные транзакции захвата не берут одну строку. */
let database: TestDatabase
let a: DbHandle
let b: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  a = appDb(database, 'claim-a')
  b = appDb(database, 'claim-b')
})
afterAll(async () => {
  await a.close()
  await b.close()
})
beforeEach(async () => truncateAll(database))

describe('claimBatch', () => {
  it('two workers claiming concurrently never receive the same row', async () => {
    for (let i = 0; i < 120; i += 1) await insertEvent(a.db)
    const rounds = await Promise.all([
      claimBatch(a.db, 'worker-a', 50),
      claimBatch(b.db, 'worker-b', 50),
      claimBatch(a.db, 'worker-c', 50),
    ])
    const keys = rounds.flat().map((row) => `${row.eventId}:${row.handler}`)
    expect(keys).toHaveLength(120)
    expect(new Set(keys).size).toBe(120)
    const owners = await a.db.execute<{ locked_by: string; n: number }>(
      sql`SELECT locked_by, count(*)::int AS n FROM outbox GROUP BY locked_by ORDER BY 1`,
    )
    expect(owners.rows.reduce((sum, row) => sum + row.n, 0)).toBe(120)
  })

  it('rows locked by an in-flight claim are skipped, not waited for (SKIP LOCKED)', async () => {
    for (let i = 0; i < 10; i += 1) await insertEvent(a.db)
    const client = await a.pool.connect()
    try {
      await client.query('BEGIN')
      const held = await client.query(
        `UPDATE outbox SET status = 'processing', locked_by = 'slow', locked_at = now(), attempts = attempts + 1
          WHERE (event_id, handler) IN (SELECT event_id, handler FROM outbox WHERE status = 'pending'
                                         ORDER BY next_attempt_at LIMIT 4 FOR UPDATE SKIP LOCKED)
          RETURNING event_id`,
      )
      expect(held.rowCount).toBe(4)
      const started = Date.now()
      const other = await claimBatch(b.db, 'fast', 50)
      expect(Date.now() - started).toBeLessThan(2_000)
      expect(other).toHaveLength(6)
      const heldIds = new Set(held.rows.map((row: { event_id: string }) => row.event_id))
      expect(other.some((row) => heldIds.has(row.eventId))).toBe(false)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })

  it('claims only pending rows that are due, oldest first, up to the batch size', async () => {
    const ids: string[] = []
    for (let i = 0; i < 5; i += 1) ids.push(await insertEvent(a.db))
    await a.db.execute(
      sql`UPDATE outbox SET next_attempt_at = now() + interval '1 hour' WHERE event_id = ${ids[0]!}`,
    )
    await a.db.execute(sql`UPDATE outbox SET status = 'done' WHERE event_id = ${ids[1]!}`)
    const claimed = await claimBatch(a.db, 'w', 2)
    expect(claimed).toHaveLength(2)
    expect(claimed.every((row) => row.attempts === 1)).toBe(true)
    const rest = await claimBatch(a.db, 'w', 50)
    expect(rest).toHaveLength(1)
    expect(await claimBatch(a.db, 'w', 50)).toEqual([])
    const rows = await outboxRows(a.db)
    expect(rows.filter((row) => row.status === 'processing').map((row) => row.locked_by)).toEqual([
      'w',
      'w',
      'w',
    ])
  })
})
