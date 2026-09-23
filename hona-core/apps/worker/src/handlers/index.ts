import type { HandlerName } from '@hona/shared'
import type { OutboxHandler } from '../outbox/types.js'
import { noopHandler } from './noop.js'

/**
 * Реализация каждого имени из реестра packages/shared. Новое имя без реализации
 * не скомпилируется.
 */
export const HANDLERS: { readonly [K in HandlerName]: OutboxHandler } = {
  noop: noopHandler,
}
