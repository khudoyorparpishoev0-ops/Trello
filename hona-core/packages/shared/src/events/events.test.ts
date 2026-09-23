import { describe, expect, it } from 'vitest'
import {
  ACTOR_KINDS,
  EVENT_SCHEMAS,
  EVENT_TYPES,
  EVENT_VIA,
  HANDLER_NAMES,
  HANDLERS_BY_TYPE,
  isEventType,
} from './index.js'

describe('event catalogue (§10.3)', () => {
  it('Phase 1 contains only the infrastructure event system.ping', () => {
    expect(EVENT_TYPES).toEqual(['system.ping'])
    expect(isEventType('system.ping')).toBe(true)
    expect(isEventType('task.created')).toBe(false)
    expect(isEventType('toString')).toBe(false)
  })

  it('every event type has a handler list made of registered handler names', () => {
    for (const type of EVENT_TYPES) {
      const handlers = HANDLERS_BY_TYPE[type]
      expect(handlers.length).toBeGreaterThan(0)
      for (const handler of handlers) expect(HANDLER_NAMES).toContain(handler)
    }
  })

  it('system.ping payload is strict', () => {
    const schema = EVENT_SCHEMAS['system.ping']
    expect(schema.parse({ note: 'hello' })).toEqual({ note: 'hello' })
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ note: '' }).success).toBe(false)
    expect(schema.safeParse({ note: 'x'.repeat(201) }).success).toBe(false)
    expect(schema.safeParse({ note: 'ok', extra: true }).success).toBe(false)
  })

  it('actor kinds and via mirror the domain_events CHECK constraints', () => {
    expect(ACTOR_KINDS).toEqual(['user', 'system', 'integration'])
    expect(EVENT_VIA).toEqual(['web', 'telegram', 'ai', 'api', 'worker'])
  })
})
