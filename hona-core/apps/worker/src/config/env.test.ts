import { describe, expect, it } from 'vitest'
import { loadWorkerConfig, WorkerConfigError } from './env.js'

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://hona_app:test-only-pw@127.0.0.1:5433/hona',
}

describe('worker env', () => {
  it('applies defaults and derives a worker id', () => {
    const config = loadWorkerConfig(base)
    expect(config).toMatchObject({ host: '127.0.0.1', logLevel: 'info', healthPort: 3001 })
    expect(config.workerId).toMatch(/-\d+$/)
    expect(loadWorkerConfig({ ...base, WORKER_ID: 'worker-a' }).workerId).toBe('worker-a')
  })

  it('reports variable names without values', () => {
    try {
      loadWorkerConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'mysql://u:very-secret-1@h/db',
        WORKER_ID: 'bad id!',
      })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(WorkerConfigError)
      const text = (err as Error).message
      expect(text).toContain('DATABASE_URL')
      expect(text).toContain('WORKER_ID')
      expect(text).not.toContain('very-secret-1')
    }
  })

  it('refuses placeholder database passwords in production', () => {
    expect(() =>
      loadWorkerConfig({
        ...base,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hona_app:change-me-app@db/hona',
      }),
    ).toThrow(/DATABASE_URL/)
    expect(
      loadWorkerConfig({
        ...base,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://hona_app:Zq8-strong@db/hona',
      }).nodeEnv,
    ).toBe('production')
  })
})
