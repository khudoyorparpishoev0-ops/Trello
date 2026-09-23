import { HANDLERS_BY_TYPE, type EventType, type HandlerName } from '@hona/shared'

/** Обработчики outbox для типа события — из статического реестра packages/shared (§10.4). */
export function handlersFor(type: EventType): readonly HandlerName[] {
  return HANDLERS_BY_TYPE[type]
}
