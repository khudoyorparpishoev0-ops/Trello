import type { Logger } from '../logger.js'

/** Событие из `domain_events`, переданное обработчику. */
export interface OutboxEvent {
  readonly id: string
  readonly type: string
  readonly companyId: string
  readonly entityType: string
  readonly entityId: string
  readonly payload: unknown
  readonly requestId: string | null
  readonly occurredAt: Date
}

export interface HandlerContext {
  readonly log: Logger
  readonly workerId: string
  readonly attempt: number
}

/**
 * Обработчик outbox. Обязан быть идемпотентным по тройке «событие, обработчик,
 * получатель» (§10.5): доставка at-least-once, повтор возможен.
 */
export type OutboxHandler = (event: OutboxEvent, ctx: HandlerContext) => Promise<void>

export type HandlerRegistry = Readonly<Record<string, OutboxHandler>>

/** Захваченная строка outbox: attempts уже увеличен при захвате. */
export interface ClaimedRow {
  readonly eventId: string
  readonly handler: string
  readonly attempts: number
}
