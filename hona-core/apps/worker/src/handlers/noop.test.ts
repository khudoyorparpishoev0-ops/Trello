import { describe, expect, it } from 'vitest'
import { memoryLogger } from '../../test/logger.js'
import { HANDLERS } from './index.js'
import { noopHandler } from './noop.js'

describe('handler registry', () => {
  it('implements every handler name from packages/shared', () => {
    expect(Object.keys(HANDLERS)).toEqual(['noop'])
    expect(HANDLERS.noop).toBe(noopHandler)
  })

  it('noop acknowledges the event without side effects', async () => {
    const { logger, lines } = memoryLogger('debug')
    await expect(
      noopHandler(
        {
          id: 'e1',
          type: 'system.ping',
          companyId: '00000000-0000-0000-0000-000000000000',
          entityType: 'system',
          entityId: 'x',
          payload: { note: 'hi' },
          requestId: null,
          occurredAt: new Date(),
        },
        { log: logger, workerId: 'w', attempt: 1 },
      ),
    ).resolves.toBeUndefined()
    expect(lines()[0]).toMatchObject({ msg: 'noop: event received', eventType: 'system.ping' })
  })
})
