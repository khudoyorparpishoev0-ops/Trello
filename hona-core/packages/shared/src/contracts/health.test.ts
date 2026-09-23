import { describe, expect, it } from 'vitest'
import { HealthResponse, ReadyResponse } from './health.js'

describe('health contracts', () => {
  it('HealthResponse is strict and requires a non-negative integer uptime', () => {
    expect(HealthResponse.parse({ status: 'ok', version: '0.1.0', uptimeS: 3 })).toBeTruthy()
    expect(HealthResponse.safeParse({ status: 'ok', version: '0.1.0', uptimeS: -1 }).success).toBe(
      false,
    )
    expect(HealthResponse.safeParse({ status: 'ok', version: '0.1.0', uptimeS: 1.5 }).success).toBe(
      false,
    )
    expect(
      HealthResponse.safeParse({ status: 'ok', version: '1', uptimeS: 1, db: 'secret' }).success,
    ).toBe(false)
  })

  it('ReadyResponse exposes only the aggregate status', () => {
    expect(ReadyResponse.parse({ status: 'ok' })).toEqual({ status: 'ok' })
    expect(ReadyResponse.parse({ status: 'unavailable' })).toEqual({ status: 'unavailable' })
    expect(ReadyResponse.safeParse({ status: 'ok', postgres: 'ok' }).success).toBe(false)
  })
})
