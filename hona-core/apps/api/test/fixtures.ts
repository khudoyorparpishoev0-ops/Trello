import { Writable } from 'node:stream'
import type { AppConfig } from '../src/core/config/env.js'
import { createLogger, type Logger } from '../src/core/logger.js'

/** Окружение, которое проходит валидацию. Значения — очевидные тестовые заглушки. */
export function validEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgres://hona_app:test-only-pw@127.0.0.1:5433/hona',
    REDIS_URL: 'redis://127.0.0.1:6380',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'hona',
    S3_ACCESS_KEY: 'hona-app',
    S3_SECRET_KEY: 'test-only-secret',
    ...overrides,
  }
}

/**
 * Конфиг, у которого все зависимости указывают на закрытые порты 127.0.0.1:1:
 * фабрика ничего не открывает, а readiness честно получает «connection refused».
 */
export function unreachableConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    appOrigin: 'http://localhost:5173',
    logLevel: 'silent',
    trustProxy: false,
    databaseUrl: 'postgres://hona_app:test-only-pw@127.0.0.1:1/hona',
    redisUrl: 'redis://127.0.0.1:1',
    s3: {
      endpoint: 'http://127.0.0.1:1',
      publicEndpoint: 'http://localhost:1',
      region: 'us-east-1',
      bucket: 'hona',
      accessKey: 'hona-app',
      secretKey: 'test-only-secret',
    },
    ...overrides,
  }
}

/** Логгер, пишущий строки JSON в память, — для проверки redact и логов ошибок. */
export function memoryLogger(level = 'info'): {
  logger: Logger
  lines: () => Record<string, unknown>[]
} {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'))
      callback()
    },
  })
  const logger = createLogger({ level, service: 'api-test', destination: stream })
  return {
    logger,
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  }
}
