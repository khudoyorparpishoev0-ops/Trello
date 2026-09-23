import { isValidRequestId } from '@hona/shared'
import { describe, expect, it } from 'vitest'
import { newId, newRequestId } from './ids.js'

describe('UUID v7 (§3)', () => {
  it('generates version-7 UUIDs that are strictly increasing, even within one millisecond', () => {
    const ids = Array.from({ length: 5_000 }, () => newId())
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
    for (let i = 1; i < ids.length; i += 1) {
      expect(ids[i - 1]! < ids[i]!).toBe(true)
    }
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('request id (ULID, §9.5)', () => {
  it('is a valid, unique, time-sortable ULID', () => {
    const early = newRequestId(1_700_000_000_000)
    const late = newRequestId(1_800_000_000_000)
    expect(isValidRequestId(early)).toBe(true)
    expect(early).toHaveLength(26)
    expect(early.slice(0, 10) < late.slice(0, 10)).toBe(true)
    const many = new Set(Array.from({ length: 1_000 }, () => newRequestId()))
    expect(many.size).toBe(1_000)
  })
})
