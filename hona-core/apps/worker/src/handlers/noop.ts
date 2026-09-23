import type { OutboxHandler } from '../outbox/types.js'

/**
 * Инфраструктурный обработчик Phase 1: подтверждает доставку `system.ping`
 * и ничего не делает. Идемпотентен по определению.
 */
export const noopHandler: OutboxHandler = (event, ctx) => {
  ctx.log.debug({ eventType: event.type, attempt: ctx.attempt }, 'noop: event received')
  return Promise.resolve()
}
