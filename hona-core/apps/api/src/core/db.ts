import { createDb, type DbHandle } from '@hona/db'
import type { AppConfig } from './config/env.js'
import type { FastifyBaseLogger as Logger } from 'fastify'
import { withTimeout } from './timeout.js'

/** Пул PostgreSQL для API. Ленивый: API стартует и без базы, readiness покажет 503. */
export function createDatabase(config: AppConfig, log: Logger): DbHandle {
  return createDb({
    connectionString: config.databaseUrl,
    applicationName: 'hona-api',
    max: 10,
    onPoolError: (err) =>
      log.warn({ err: { message: err.message } }, 'postgres: idle client error'),
  })
}

/** Readiness: `SELECT 1` не дольше `timeoutMs` (§23.9). */
export async function pingDatabase(handle: DbHandle, timeoutMs: number): Promise<void> {
  await withTimeout(handle.pool.query('SELECT 1'), timeoutMs, 'postgres')
}
