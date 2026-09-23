import { domainEvents, type Db } from '@hona/db'
import { inArray, sql } from 'drizzle-orm'
import type { Logger } from '../logger.js'
import { backoffDelayMs, isExhausted } from './retry.js'
import type { ClaimedRow, HandlerRegistry, OutboxEvent } from './types.js'

/** Обработчик, зависший дольше этого, считается упавшим (меньше lease 5 мин). */
export const HANDLER_TIMEOUT_MS = 60_000
/** `last_error` хранится усечённым: это диагностика, а не лог. */
export const MAX_ERROR_LENGTH = 2_000

export type DispatchResult = 'done' | 'retry' | 'dead_letter' | 'lease_lost'

export interface DispatchDeps {
  readonly db: Db
  readonly workerId: string
  readonly handlers: HandlerRegistry
  readonly log: Logger
  readonly random?: () => number
  readonly handlerTimeoutMs?: number
}

function errorText(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text
}

async function runWithTimeout(work: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`handler timed out after ${ms} ms`)), ms)
  })
  work.catch(() => undefined)
  try {
    await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Все переходы ниже защищены условием «строка всё ещё processing и захвачена
 * этим воркером». Если свип вернул строку другому воркеру, результат старого
 * не затирает новое состояние (lease_lost), доставка остаётся at-least-once.
 */
async function markDone(db: Db, row: ClaimedRow, workerId: string): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE outbox
       SET status = 'done', processed_at = now(), locked_by = NULL, locked_at = NULL, last_error = NULL
     WHERE event_id = ${row.eventId} AND handler = ${row.handler}
       AND status = 'processing' AND locked_by = ${workerId}`)
  return (result.rowCount ?? 0) === 1
}

async function scheduleRetry(
  db: Db,
  row: ClaimedRow,
  workerId: string,
  delayMs: number,
  error: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE outbox
       SET status = 'pending',
           next_attempt_at = now() + make_interval(secs => ${delayMs / 1000}),
           locked_by = NULL, locked_at = NULL, last_error = ${error}
     WHERE event_id = ${row.eventId} AND handler = ${row.handler}
       AND status = 'processing' AND locked_by = ${workerId}`)
  return (result.rowCount ?? 0) === 1
}

/** Перенос в dead-letter и удаление из outbox — одна команда, одна транзакция. */
async function moveToDeadLetter(
  db: Db,
  row: ClaimedRow,
  workerId: string,
  error: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    WITH moved AS (
      DELETE FROM outbox
       WHERE event_id = ${row.eventId} AND handler = ${row.handler}
         AND status = 'processing' AND locked_by = ${workerId}
      RETURNING event_id, handler, company_id, attempts
    )
    INSERT INTO outbox_dead_letter (event_id, handler, company_id, attempts, last_error)
    SELECT event_id, handler, company_id, attempts, ${error} FROM moved
    ON CONFLICT (event_id, handler) DO UPDATE
       SET attempts = EXCLUDED.attempts, last_error = EXCLUDED.last_error,
           failed_at = now(), retried_at = NULL`)
  return (result.rowCount ?? 0) === 1
}

async function loadEvents(db: Db, ids: readonly string[]): Promise<Map<string, OutboxEvent>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select()
    .from(domainEvents)
    .where(inArray(domainEvents.id, [...ids]))
  return new Map(rows.map((row) => [row.id, row]))
}

async function dispatchRow(
  deps: DispatchDeps,
  row: ClaimedRow,
  event: OutboxEvent | undefined,
): Promise<DispatchResult> {
  const started = performance.now()
  const base = {
    eventId: row.eventId,
    type: event?.type ?? null,
    handler: row.handler,
    attempt: row.attempts,
  }
  try {
    if (event === undefined) throw new Error('domain event not found')
    const handler = deps.handlers[row.handler]
    if (handler === undefined) throw new Error(`no handler registered for "${row.handler}"`)
    await runWithTimeout(
      handler(event, {
        log: deps.log.child({ eventId: row.eventId, handler: row.handler }),
        workerId: deps.workerId,
        attempt: row.attempts,
      }),
      deps.handlerTimeoutMs ?? HANDLER_TIMEOUT_MS,
    )
    const durationMs = Math.round(performance.now() - started)
    if (!(await markDone(deps.db, row, deps.workerId))) {
      deps.log.warn({ ...base, durationMs, result: 'lease_lost' }, 'outbox: lease lost')
      return 'lease_lost'
    }
    deps.log.info({ ...base, durationMs, result: 'done' }, 'outbox: delivered')
    return 'done'
  } catch (err) {
    const durationMs = Math.round(performance.now() - started)
    const error = errorText(err)
    if (isExhausted(row.attempts)) {
      const moved = await moveToDeadLetter(deps.db, row, deps.workerId, error)
      const result: DispatchResult = moved ? 'dead_letter' : 'lease_lost'
      deps.log.error({ ...base, durationMs, result, error }, 'outbox: moved to dead-letter')
      return result
    }
    const delayMs = backoffDelayMs(row.attempts, deps.random)
    const scheduled = await scheduleRetry(deps.db, row, deps.workerId, delayMs, error)
    const result: DispatchResult = scheduled ? 'retry' : 'lease_lost'
    deps.log.warn(
      { ...base, durationMs, result, error, retryInMs: delayMs },
      'outbox: handler failed',
    )
    return result
  }
}

/**
 * Каждая строка уходит в свой обработчик независимо (§10.5): ошибка одного
 * не задерживает и не повторяет другие.
 */
export async function dispatchBatch(
  deps: DispatchDeps,
  rows: readonly ClaimedRow[],
): Promise<DispatchResult[]> {
  const events = await loadEvents(deps.db, [...new Set(rows.map((row) => row.eventId))])
  return Promise.all(rows.map((row) => dispatchRow(deps, row, events.get(row.eventId))))
}
