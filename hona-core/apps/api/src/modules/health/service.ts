import type { DbHandle } from '@hona/db'
import type { S3Client } from '@aws-sdk/client-s3'
import type { Redis } from 'ioredis'
import { pingDatabase } from '../../core/db.js'
import { pingRedis } from '../../core/redis.js'
import { headBucket } from '../../core/s3.js'

/** Таймаут каждой проверки readiness (§23.9: `SELECT 1` с таймаутом 1 с). */
export const READINESS_TIMEOUT_MS = 1_000

export interface ReadinessDeps {
  readonly db: DbHandle
  readonly redis: Redis
  readonly s3: S3Client
  readonly bucket: string
}

export type CheckName = 'postgres' | 'redis' | 's3'

export interface CheckResult {
  readonly ok: boolean
  readonly durationMs: number
  /** Сообщение ошибки для лога. Наружу не отдаётся. */
  readonly error?: string
}

export interface Readiness {
  readonly ready: boolean
  readonly checks: Readonly<Record<CheckName, CheckResult>>
}

async function run(check: () => Promise<void>): Promise<CheckResult> {
  const started = performance.now()
  try {
    await check()
    return { ok: true, durationMs: Math.round(performance.now() - started) }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error'
    return { ok: false, durationMs: Math.round(performance.now() - started), error: message }
  }
}

/** Проверки идут параллельно; готовность — только если прошли все три. */
export async function checkReadiness(deps: ReadinessDeps): Promise<Readiness> {
  const [postgres, redis, s3] = await Promise.all([
    run(() => pingDatabase(deps.db, READINESS_TIMEOUT_MS)),
    run(() => pingRedis(deps.redis, READINESS_TIMEOUT_MS)),
    run(() => headBucket(deps.s3, deps.bucket, READINESS_TIMEOUT_MS)),
  ])
  return { ready: postgres.ok && redis.ok && s3.ok, checks: { postgres, redis, s3 } }
}
