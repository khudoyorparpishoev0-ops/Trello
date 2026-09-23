import { SYSTEM_COMPANY_ID, type ActorKind, type EventVia } from '@hona/shared'
import type { FastifyBaseLogger } from 'fastify'

/**
 * Контекст запроса (§9.5). В Phase 1 аутентификации нет, поэтому HTTP-запросы идут
 * от анонимного актора, а компании у запроса нет. Сессии, пользователь и активная
 * компания появляются в Phase 2; поддельных пользователей здесь нет.
 */
export type Actor =
  | { readonly kind: 'anonymous'; readonly userId: null; readonly via: null }
  | { readonly kind: 'system'; readonly userId: null; readonly via: EventVia | null }

/**
 * Актор, от имени которого можно писать события (`domain_events.actor_kind`).
 * Анонимный запрос событий не пишет — это проверяет компилятор.
 */
export type EventActor = Extract<Actor, { kind: ActorKind }>

export interface RequestContext {
  readonly requestId: string
  readonly actor: Actor
  /** Активная компания сессии; `null`, пока нет аутентификации (Phase 1). */
  readonly companyId: string | null
  /** Инъекция времени для тестов. */
  readonly now: () => Date
  /** pino child с requestId (у запроса) или логгер процесса (у системного контекста). */
  readonly log: FastifyBaseLogger
}

/** Контекст, достаточный для `emit()`: актор-событие и компания обязательны. */
export interface EventContext extends RequestContext {
  readonly actor: EventActor
  readonly companyId: string
}

export const ANONYMOUS_ACTOR: Actor = Object.freeze({ kind: 'anonymous', userId: null, via: null })

export function httpRequestContext(requestId: string, log: FastifyBaseLogger): RequestContext {
  return { requestId, actor: ANONYMOUS_ACTOR, companyId: null, now: () => new Date(), log }
}

/**
 * Системный контекст для инфраструктурных событий (`system.ping`). Системный актор
 * от имени людей не действует (§8.4 п.8); компания — `SYSTEM_COMPANY_ID`.
 */
export function systemContext(options: {
  requestId: string
  log: FastifyBaseLogger
  via?: EventVia | null
  now?: () => Date
}): EventContext {
  return {
    requestId: options.requestId,
    actor: { kind: 'system', userId: null, via: options.via ?? null },
    companyId: SYSTEM_COMPANY_ID,
    now: options.now ?? (() => new Date()),
    log: options.log,
  }
}
