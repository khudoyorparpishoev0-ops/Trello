import { describe, expect, it } from 'vitest'
import { memoryLogger } from '../../test/fixtures.js'
import { REDACTED } from './logger.js'

describe('logger redact (§23.9)', () => {
  it('hides cookies, authorization, passwords, tokens, secrets and connection strings', () => {
    const { logger, lines } = memoryLogger()
    logger.info(
      {
        req: { headers: { cookie: 'sid=abc', authorization: 'Bearer xyz', 'x-api-key': 'k' } },
        res: { headers: { 'set-cookie': 'sid=abc' } },
        headers: { cookie: 'c', authorization: 'a' },
        user: { password: 'p@ss', token: 't0k', secret: 's3c' },
        config: { databaseUrl: 'postgres://u:pw@h/db', secretKey: 'sk', accessKey: 'ak' },
        env: { DATABASE_URL: 'postgres://u:pw@h/db', S3_SECRET_KEY: 'sk' },
        password: 'top',
      },
      'sensitive',
    )
    const [line] = lines()
    const text = JSON.stringify(line)
    for (const leaked of [
      'sid=abc',
      'Bearer xyz',
      'p@ss',
      't0k',
      's3c',
      'postgres://u:pw',
      '"sk"',
      '"ak"',
      'top',
    ]) {
      expect(text).not.toContain(leaked)
    }
    expect(line).toMatchObject({
      level: 'info',
      service: 'api-test',
      msg: 'sensitive',
      req: { headers: { cookie: REDACTED, authorization: REDACTED } },
      user: { password: REDACTED, token: REDACTED, secret: REDACTED },
    })
  })

  it('writes JSON with ISO time and a textual level', () => {
    const { logger, lines } = memoryLogger('debug')
    logger.debug({ requestId: 'r1' }, 'hello')
    const [line] = lines()
    expect(line).toMatchObject({ level: 'debug', requestId: 'r1', msg: 'hello' })
    expect(typeof line?.time).toBe('string')
    expect(Number.isNaN(Date.parse(String(line?.time)))).toBe(false)
  })
})
