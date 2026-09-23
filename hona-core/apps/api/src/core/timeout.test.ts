import { describe, expect, it } from 'vitest'
import { TimeoutError, withTimeout } from './timeout.js'

describe('withTimeout', () => {
  it('returns the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 50, 'x')).resolves.toBe(42)
  })

  it('rejects with TimeoutError and swallows the late rejection', async () => {
    const late = new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 30))
    await expect(withTimeout(late, 5, 'slow')).rejects.toBeInstanceOf(TimeoutError)
    await new Promise((resolve) => setTimeout(resolve, 40))
  })

  it('propagates the original error when it comes first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50, 'x')).rejects.toThrow('boom')
  })
})
