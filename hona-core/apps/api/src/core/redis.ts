import { Redis } from 'ioredis'
import type { AppConfig } from './config/env.js'
import type { FastifyBaseLogger as Logger } from 'fastify'
import { withTimeout } from './timeout.js'

/**
 * Redis — инфраструктура realtime и счётчиков будущих фаз; в Phase 1 только readiness.
 * Источником истины Redis не является. Соединение ленивое: API стартует и без Redis.
 */
export function createRedis(config: AppConfig, log: Logger): Redis {
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    connectTimeout: 1_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  })
  let lastError: string | undefined
  redis.on('error', (err: Error) => {
    // ioredis повторяет попытки бесконечно — пишем в лог только смену ошибки.
    if (err.message === lastError) return
    lastError = err.message
    log.warn({ err: { message: err.message } }, 'redis: connection error')
  })
  redis.on('ready', () => {
    if (lastError !== undefined) log.info('redis: connection restored')
    lastError = undefined
  })
  return redis
}

export async function pingRedis(redis: Redis, timeoutMs: number): Promise<void> {
  const reply = await withTimeout(redis.ping(), timeoutMs, 'redis')
  if (reply !== 'PONG') throw new Error('redis: unexpected PING reply')
}

export async function closeRedis(redis: Redis): Promise<void> {
  if (redis.status === 'ready') {
    await withTimeout(redis.quit(), 2_000, 'redis quit').catch(() => redis.disconnect())
  } else {
    redis.disconnect()
  }
}
