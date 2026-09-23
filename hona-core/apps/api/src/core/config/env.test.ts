import { describe, expect, it } from 'vitest'
import { validEnv } from '../../../test/fixtures.js'
import { ConfigError, loadConfig } from './env.js'

describe('Env schema (§14.4, §23.9)', () => {
  it('parses a valid environment into a frozen config with defaults', () => {
    const config = loadConfig(validEnv())
    expect(config).toMatchObject({
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3000,
      appOrigin: 'http://localhost:5173',
      logLevel: 'info',
      trustProxy: false,
      s3: { bucket: 'hona', region: 'us-east-1' },
    })
    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.s3)).toBe(true)
  })

  it('lists every missing variable by name', () => {
    const error = (() => {
      try {
        loadConfig({})
      } catch (err) {
        return err
      }
      return undefined
    })()
    expect(error).toBeInstanceOf(ConfigError)
    const names = (error as ConfigError).issues.map((issue) => issue.variable)
    for (const name of [
      'NODE_ENV',
      'APP_ORIGIN',
      'DATABASE_URL',
      'REDIS_URL',
      'S3_ENDPOINT',
      'S3_PUBLIC_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('never echoes secret values in the error text', () => {
    const secret = 'super-secret-value-9f8e7d'
    const env = validEnv({
      DATABASE_URL: `mysql://hona:${secret}@db/hona`,
      S3_SECRET_KEY: 'short',
      REDIS_URL: `not a url ${secret}`,
      PORT: 'abc',
    })
    try {
      loadConfig(env)
      expect.unreachable('config should be rejected')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError)
      const text = `${(err as Error).message} ${JSON.stringify((err as ConfigError).issues)}`
      expect(text).not.toContain(secret)
      expect(text).not.toContain('short')
      expect(text).toContain('DATABASE_URL')
      expect(text).toContain('S3_SECRET_KEY')
      expect(text).toContain('PORT')
    }
  })

  it('rejects an APP_ORIGIN with a path', () => {
    expect(() => loadConfig(validEnv({ APP_ORIGIN: 'http://localhost:5173/app' }))).toThrow(
      /APP_ORIGIN/,
    )
  })

  it.each([
    ['false', false],
    ['true', true],
    ['2', 2],
    ['10.0.0.1, 10.0.0.0/8', ['10.0.0.1', '10.0.0.0/8']],
  ] as const)('TRUST_PROXY=%s', (raw, expected) => {
    expect(loadConfig(validEnv({ TRUST_PROXY: raw })).trustProxy).toEqual(expected)
  })

  describe('production expectations', () => {
    const prod = (overrides: Record<string, string> = {}) =>
      validEnv({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://core.example.test',
        S3_PUBLIC_ENDPOINT: 'https://files.core.example.test',
        DATABASE_URL: 'postgres://hona_app:Zq8-real-looking-pw@db:5432/hona',
        S3_SECRET_KEY: 'Zq8-real-looking-s3-key',
        ...overrides,
      })

    it('accepts https origins and non-placeholder secrets', () => {
      expect(loadConfig(prod()).nodeEnv).toBe('production')
    })

    it('requires https for public URLs', () => {
      expect(() => loadConfig(prod({ APP_ORIGIN: 'http://core.example.test' }))).toThrow(
        /APP_ORIGIN/,
      )
      expect(() => loadConfig(prod({ S3_PUBLIC_ENDPOINT: 'http://files.test' }))).toThrow(
        /S3_PUBLIC_ENDPOINT/,
      )
    })

    it('refuses placeholder secrets from .env.example', () => {
      expect(() =>
        loadConfig(prod({ DATABASE_URL: 'postgres://hona_app:change-me-app@db:5432/hona' })),
      ).toThrow(/DATABASE_URL/)
      expect(() => loadConfig(prod({ S3_SECRET_KEY: 'change-me-s3-secret' }))).toThrow(
        /S3_SECRET_KEY/,
      )
      expect(() => loadConfig(prod({ DATABASE_URL: 'postgres://hona_app@db:5432/hona' }))).toThrow(
        /DATABASE_URL/,
      )
    })
  })
})
