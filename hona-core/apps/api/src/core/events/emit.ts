import { domainEvents, outbox } from '@hona/db'
import { EVENT_SCHEMAS, type EntityRef, type EventPayload, type EventType } from '@hona/shared'
import { sql } from 'drizzle-orm'
import type { EventContext } from '../context.js'
import { newId } from '../ids.js'
import type { Tx } from '../tx.js'
import { handlersFor } from './handlers.js'

/**
 * Запись доменного события (§10.4). Работает только внутри транзакции вызывающего:
 * событие, строки outbox (по одной на обработчик) и NOTIFY фиксируются вместе с
 * данными или откатываются вместе с ними. Невалидный payload бросает исключение
 * и откатывает всю транзакцию. NOTIFY PostgreSQL доставляет только после COMMIT.
 */
export async function emit<T extends EventType>(
  tx: Tx,
  ctx: EventContext,
  type: T,
  entity: EntityRef,
  payload: EventPayload<T>,
): Promise<string> {
  const parsed = EVENT_SCHEMAS[type].parse(payload)
  const eventId = newId()
  await tx.insert(domainEvents).values({
    id: eventId,
    companyId: ctx.companyId,
    type,
    entityType: entity.type,
    entityId: entity.id,
    actorUserId: ctx.actor.userId,
    actorKind: ctx.actor.kind,
    via: ctx.actor.via,
    payload: parsed,
    requestId: ctx.requestId,
  })
  const handlers = handlersFor(type)
  if (handlers.length > 0) {
    await tx
      .insert(outbox)
      .values(handlers.map((handler) => ({ eventId, handler, companyId: ctx.companyId })))
    await tx.execute(sql`SELECT pg_notify('outbox_new', '')`)
  }
  return eventId
}
