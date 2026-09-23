import { SYSTEM_COMPANY_ID } from '@hona/shared'
import { describe, expect, it } from 'vitest'
import { memoryLogger } from '../../test/fixtures.js'
import { ANONYMOUS_ACTOR, httpRequestContext, systemContext } from './context.js'

describe('RequestContext (§9.5)', () => {
  it('HTTP requests in Phase 1 are anonymous and have no company', () => {
    const { logger } = memoryLogger()
    const ctx = httpRequestContext('req-1', logger)
    expect(ctx.actor).toBe(ANONYMOUS_ACTOR)
    expect(ctx.actor).toEqual({ kind: 'anonymous', userId: null, via: null })
    expect(ctx.companyId).toBeNull()
    expect(ctx.now()).toBeInstanceOf(Date)
  })

  it('system context uses the system actor and the system company, never a user', () => {
    const { logger } = memoryLogger()
    const fixed = new Date('2026-09-23T00:00:00Z')
    const ctx = systemContext({ requestId: 'req-2', log: logger, now: () => fixed })
    expect(ctx.actor).toEqual({ kind: 'system', userId: null, via: null })
    expect(ctx.companyId).toBe(SYSTEM_COMPANY_ID)
    expect(ctx.now()).toBe(fixed)
    expect(systemContext({ requestId: 'r', log: logger, via: 'worker' }).actor.via).toBe('worker')
  })
})
