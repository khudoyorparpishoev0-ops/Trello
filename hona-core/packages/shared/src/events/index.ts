import type { z } from 'zod'
import { SystemPingPayload } from './system.js'

/**
 * Каталог событий (§10.3). Каждый тип — zod-схема payload; `emit()` отказывается
 * писать payload, не прошедший схему. В Phase 1 есть только `system.ping`:
 * бизнес-события появляются вместе со своими доменами.
 */
export const EVENT_SCHEMAS = {
  'system.ping': SystemPingPayload,
} as const satisfies Record<string, z.ZodType>

export type EventType = keyof typeof EVENT_SCHEMAS
export type EventPayload<T extends EventType> = z.infer<(typeof EVENT_SCHEMAS)[T]>

export const EVENT_TYPES = Object.keys(EVENT_SCHEMAS) as [EventType, ...EventType[]]

export function isEventType(value: string): value is EventType {
  return Object.hasOwn(EVENT_SCHEMAS, value)
}

/**
 * Обработчики outbox (§10.2: одна строка outbox на пару «событие, обработчик»).
 * Phase 1 — только `noop`; realtime, notifications, telegram, email, webhooks
 * добавляются в своих фазах.
 */
export const HANDLER_NAMES = ['noop'] as const
export type HandlerName = (typeof HANDLER_NAMES)[number]

/** Статический реестр «тип события → обработчики» (§10.4). */
export const HANDLERS_BY_TYPE: { readonly [T in EventType]: readonly HandlerName[] } = {
  'system.ping': ['noop'],
}

/** Значения CHECK-ограничений `domain_events` (§10.2). */
export const ACTOR_KINDS = ['user', 'system', 'integration'] as const
export type ActorKind = (typeof ACTOR_KINDS)[number]

export const EVENT_VIA = ['web', 'telegram', 'ai', 'api', 'worker'] as const
export type EventVia = (typeof EVENT_VIA)[number]

/** Сущность, к которой относится событие. */
export interface EntityRef {
  readonly type: string
  readonly id: string
}

export { SystemPingPayload } from './system.js'
