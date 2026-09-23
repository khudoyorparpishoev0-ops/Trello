import { describe, expect, it } from 'vitest'
import { backoffDelayMs, isExhausted, MAX_ATTEMPTS, MAX_DELAY_MS } from './retry.js'

const noJitter = () => 0.5 // random() * 2 - 1 = 0

describe('retry backoff (§10.5)', () => {
  it('doubles from 5 s and caps at 1 h', () => {
    const delays = Array.from({ length: 13 }, (_, i) => backoffDelayMs(i + 1, noJitter))
    expect(delays).toEqual([
      5_000,
      10_000,
      20_000,
      40_000,
      80_000,
      160_000,
      320_000,
      640_000,
      1_280_000,
      2_560_000,
      MAX_DELAY_MS,
      MAX_DELAY_MS,
      MAX_DELAY_MS,
    ])
  })

  it('applies ±20 % jitter', () => {
    expect(backoffDelayMs(1, () => 0)).toBe(4_000)
    expect(backoffDelayMs(1, () => 1)).toBe(6_000)
    expect(backoffDelayMs(11, () => 0)).toBe(MAX_DELAY_MS * 0.8)
    for (let i = 0; i < 200; i += 1) {
      const delay = backoffDelayMs(3)
      expect(delay).toBeGreaterThanOrEqual(16_000)
      expect(delay).toBeLessThanOrEqual(24_000)
    }
  })

  it('keeps the whole retry window around 3.5 hours before dead-letter', () => {
    let total = 0
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1)
      total += backoffDelayMs(attempt, noJitter)
    const hours = total / 3_600_000
    expect(hours).toBeGreaterThan(2)
    expect(hours).toBeLessThan(4.5)
  })

  it('dead-letters on the 12th attempt', () => {
    expect(MAX_ATTEMPTS).toBe(12)
    expect(isExhausted(11)).toBe(false)
    expect(isExhausted(12)).toBe(true)
    expect(isExhausted(13)).toBe(true)
  })

  it('rejects impossible attempt counts', () => {
    expect(() => backoffDelayMs(0)).toThrow(RangeError)
    expect(() => backoffDelayMs(1.5)).toThrow(RangeError)
  })
})
