import { randomUUID } from 'node:crypto'
import { domainEvents, outbox, type Db } from '@hona/db'
import { sql } from 'drizzle-orm'

/**
 * Событие и строки outbox в той же форме, что пишет emit() (§10.4). Воркер не
 * импортирует API (границы пакетов, §4), поэтому в его тестах строки создаются
 * напрямую; сквозной путь через настоящий emit() — tests/integration/system-ping.
 */
export async function insertEvent(
  db: Db,
  handlers: readonly string[] = ['noop'],
  type = 'system.ping',
): Promise<string> {
  const id = randomUUID()
  const companyId = '00000000-0000-0000-0000-000000000000'
  await db.transaction(async (tx) => {
    await tx.insert(domainEvents).values({
      id,
      companyId,
      type,
      entityType: 'system',
      entityId: id,
      actorKind: 'system',
      payload: { note: 'fixture' },
    })
    if (handlers.length > 0) {
      await tx
        .insert(outbox)
        .values(handlers.map((handler) => ({ eventId: id, handler, companyId })))
    }
  })
  return id
}

/** «Прошло время»: все отложенные повторы становятся готовыми к захвату. */
export async function makeAllDue(db: Db): Promise<void> {
  await db.execute(sql`UPDATE outbox SET next_attempt_at = now() WHERE status = 'pending'`)
}

export async function outboxRows(db: Db) {
  const result = await db.execute<{
    event_id: string
    handler: string
    status: string
    attempts: number
    locked_by: string | null
    last_error: string | null
    delay_s: number
  }>(sql`
    SELECT event_id, handler, status, attempts, locked_by, last_error,
           EXTRACT(EPOCH FROM (next_attempt_at - now()))::float AS delay_s
      FROM outbox ORDER BY created_at, handler`)
  return result.rows
}

export async function deadLetterRows(db: Db) {
  const result = await db.execute<{
    event_id: string
    handler: string
    attempts: number
    last_error: string
  }>(sql`SELECT event_id, handler, attempts, last_error FROM outbox_dead_letter ORDER BY failed_at`)
  return result.rows
}
