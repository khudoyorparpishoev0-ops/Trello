import type { Db } from '@hona/db'
import { sql } from 'drizzle-orm'
import { MAX_ATTEMPTS } from './retry.js'

/** Строка в processing дольше этого — воркер упал посередине (§10.5). */
export const STUCK_AFTER_MS = 5 * 60 * 1_000
/** Строки done удаляются через 24 ч; событие остаётся в domain_events навсегда (§21.3). */
export const DONE_RETENTION_MS = 24 * 60 * 60 * 1_000
/** Удаление done — ограниченными порциями, без неограниченных запросов. */
export const PURGE_BATCH_SIZE = 1_000

const LEASE_EXPIRED = 'lease expired: worker stopped while processing'

export interface SweepResult {
  readonly reclaimed: number
  readonly deadLettered: number
  readonly purged: number
}

/**
 * Возврат брошенных строк. Строка, у которой попытки уже исчерпаны, в pending
 * не возвращается (иначе «ядовитое» событие, роняющее воркер, крутилось бы
 * вечно), а уходит в dead-letter.
 */
export async function reclaimStuck(
  db: Db,
  stuckAfterMs: number = STUCK_AFTER_MS,
): Promise<{ reclaimed: number; deadLettered: number }> {
  const seconds = stuckAfterMs / 1000
  const dead = await db.execute(sql`
    WITH moved AS (
      DELETE FROM outbox
       WHERE status = 'processing'
         AND locked_at < now() - make_interval(secs => ${seconds})
         AND attempts >= ${MAX_ATTEMPTS}
      RETURNING event_id, handler, company_id, attempts
    )
    INSERT INTO outbox_dead_letter (event_id, handler, company_id, attempts, last_error)
    SELECT event_id, handler, company_id, attempts, ${LEASE_EXPIRED} FROM moved
    ON CONFLICT (event_id, handler) DO UPDATE
       SET attempts = EXCLUDED.attempts, last_error = EXCLUDED.last_error,
           failed_at = now(), retried_at = NULL`)
  const reclaimed = await db.execute(sql`
    UPDATE outbox
       SET status = 'pending', locked_by = NULL, locked_at = NULL,
           next_attempt_at = now(), last_error = ${LEASE_EXPIRED}
     WHERE status = 'processing'
       AND locked_at < now() - make_interval(secs => ${seconds})`)
  return { reclaimed: reclaimed.rowCount ?? 0, deadLettered: dead.rowCount ?? 0 }
}

export async function purgeDone(
  db: Db,
  retentionMs: number = DONE_RETENTION_MS,
  limit: number = PURGE_BATCH_SIZE,
): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM outbox
     WHERE (event_id, handler) IN (
       SELECT event_id, handler FROM outbox
        WHERE status = 'done' AND processed_at < now() - make_interval(secs => ${retentionMs / 1000})
        LIMIT ${limit}
     )`)
  return result.rowCount ?? 0
}

export async function sweep(db: Db): Promise<SweepResult> {
  const { reclaimed, deadLettered } = await reclaimStuck(db)
  const purged = await purgeDone(db)
  return { reclaimed, deadLettered, purged }
}
