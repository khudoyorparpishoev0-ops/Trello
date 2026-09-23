import type { Db } from '@hona/db'
import { sql } from 'drizzle-orm'
import type { ClaimedRow } from './types.js'

/** Размер пачки (§10.5). */
export const CLAIM_BATCH_SIZE = 50

/**
 * Захват пачки строк outbox (§10.5, SQL как в архитектуре). `FOR UPDATE SKIP LOCKED`
 * гарантирует, что две параллельные транзакции захвата не получат одну строку:
 * строка, заблокированная первой, второй пропускается. Захват — одна автокоммитная
 * команда, поэтому состояние `processing` видно всем сразу после неё; брошенные
 * строки возвращает свип (lease 5 мин).
 */
export async function claimBatch(
  db: Db,
  workerId: string,
  limit: number = CLAIM_BATCH_SIZE,
): Promise<ClaimedRow[]> {
  const result = await db.execute<{ event_id: string; handler: string; attempts: number }>(sql`
    UPDATE outbox
       SET status = 'processing', locked_by = ${workerId}, locked_at = now(), attempts = attempts + 1
     WHERE (event_id, handler) IN (
       SELECT event_id, handler FROM outbox
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING event_id, handler, attempts`)
  return result.rows.map((row) => ({
    eventId: row.event_id,
    handler: row.handler,
    attempts: row.attempts,
  }))
}
