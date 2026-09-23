import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Domain events + transactional outbox (§10.2). DDL совпадает с архитектурой;
 * имена индексов, PK и FK — те, что PostgreSQL выдал бы для безымянных объектов.
 * Все FK — NO ACTION: CASCADE в схеме запрещён (§5.1, §21).
 */

/** Журнал фактов: неизменяемый, хранится вечно, без FK на сущности. */
export const domainEvents = pgTable(
  'domain_events',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull(),
    type: text('type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorKind: text('actor_kind').notNull().default('user'),
    via: text('via'),
    payload: jsonb('payload').notNull(),
    requestId: text('request_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('domain_events_actor_kind_check', sql`${t.actorKind} IN ('user','system','integration')`),
    check('domain_events_via_check', sql`${t.via} IN ('web','telegram','ai','api','worker')`),
    index('domain_events_company_id_occurred_at_idx').on(t.companyId, t.occurredAt),
    index('domain_events_entity_type_entity_id_occurred_at_idx').on(
      t.entityType,
      t.entityId,
      t.occurredAt,
    ),
  ],
)

/** Очередь доставки: одна строка на пару «событие, обработчик». */
export const outbox = pgTable(
  'outbox',
  {
    eventId: uuid('event_id').notNull(),
    handler: text('handler').notNull(),
    companyId: uuid('company_id').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ name: 'outbox_pkey', columns: [t.eventId, t.handler] }),
    foreignKey({
      name: 'outbox_event_id_fkey',
      columns: [t.eventId],
      foreignColumns: [domainEvents.id],
    }),
    check('outbox_status_check', sql`${t.status} IN ('pending','processing','done')`),
    index('outbox_ready')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
  ],
)

/** Строки, исчерпавшие попытки (12). Событие остаётся в `domain_events`. */
export const outboxDeadLetter = pgTable(
  'outbox_dead_letter',
  {
    eventId: uuid('event_id').notNull(),
    handler: text('handler').notNull(),
    companyId: uuid('company_id').notNull(),
    attempts: integer('attempts').notNull(),
    lastError: text('last_error').notNull(),
    failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
    retriedAt: timestamp('retried_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ name: 'outbox_dead_letter_pkey', columns: [t.eventId, t.handler] }),
    foreignKey({
      name: 'outbox_dead_letter_event_id_fkey',
      columns: [t.eventId],
      foreignColumns: [domainEvents.id],
    }),
  ],
)
