import { describe, expect, it } from 'vitest'
import { isValidRequestId, SYSTEM_COMPANY_ID, UuidSchema } from './ids.js'

describe('isValidRequestId', () => {
  it.each([
    '01J8Z3K4M5N6P7Q8R9S0T1V2W3',
    '01j8z3k4m5n6p7q8r9s0t1v2w3',
    '0190c2b4-5a6b-7c8d-9e0f-a1b2c3d4e5f6',
    'D3B07384-D113-4EC6-A1C2-0A5E1F7C9B11',
  ])('accepts %s', (value) => {
    expect(isValidRequestId(value)).toBe(true)
  })

  it.each([
    '',
    'not valid!',
    '01J8Z3K4M5N6P7Q8R9S0T1V2W', // 25 символов
    '01J8Z3K4M5N6P7Q8R9S0T1V2WU', // U нет в Crockford base32
    '0190c2b4-5a6b-7c8d-9e0f-a1b2c3d4e5f6\n',
    'x'.repeat(500),
  ])('rejects %j', (value) => {
    expect(isValidRequestId(value)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isValidRequestId(undefined)).toBe(false)
    expect(isValidRequestId(['01J8Z3K4M5N6P7Q8R9S0T1V2W3'])).toBe(false)
    expect(isValidRequestId(42)).toBe(false)
  })
})

describe('SYSTEM_COMPANY_ID', () => {
  it('is the nil UUID and never a v7 id', () => {
    expect(SYSTEM_COMPANY_ID).toBe('00000000-0000-0000-0000-000000000000')
    expect(UuidSchema.safeParse(SYSTEM_COMPANY_ID).success).toBe(true)
    expect(SYSTEM_COMPANY_ID.charAt(14)).not.toBe('7')
  })
})
