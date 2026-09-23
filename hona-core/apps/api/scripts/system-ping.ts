import { outbox } from '@hona/db'
import { eq } from 'drizzle-orm'
import { loadConfigOrExit } from '../src/core/config/env.js'
import { systemContext } from '../src/core/context.js'
import { createDatabase } from '../src/core/db.js'
import { emit } from '../src/core/events/emit.js'
import { newId, newRequestId } from '../src/core/ids.js'
import { createLogger } from '../src/core/logger.js'
import { withTransaction } from '../src/core/tx.js'

/**
 * Приёмочная проверка Phase 1 (§23.11 п.4): `system.ping` проходит
 * emit → domain_events → outbox → воркер → noop. Скрипт пишет событие в
 * транзакции и ждёт, пока воркер отметит строку outbox как done.
 * Это не бизнес-функция и не HTTP-эндпоинт.
 */
const WAIT_MS = 15_000

const config = loadConfigOrExit()
const log = createLogger({ level: config.logLevel, service: 'system-ping' })
const database = createDatabase(config, log)

try {
  const pingId = newId()
  const ctx = systemContext({ requestId: newRequestId(), log })
  const eventId = await withTransaction(database.db, (tx) =>
    emit(tx, ctx, 'system.ping', { type: 'system', id: pingId }, { note: 'phase 1 acceptance' }),
  )
  log.info({ eventId, requestId: ctx.requestId }, 'system.ping: emitted')

  const started = Date.now()
  for (;;) {
    const rows = await database.db
      .select({ handler: outbox.handler, status: outbox.status, attempts: outbox.attempts })
      .from(outbox)
      .where(eq(outbox.eventId, eventId))
    if (rows.length > 0 && rows.every((row) => row.status === 'done')) {
      log.info(
        { eventId, handlers: rows, waitedMs: Date.now() - started },
        'system.ping: delivered',
      )
      break
    }
    if (Date.now() - started > WAIT_MS) {
      log.error(
        { eventId, handlers: rows },
        'system.ping: not delivered in time — is the worker running?',
      )
      process.exitCode = 1
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
} finally {
  await database.close()
}
