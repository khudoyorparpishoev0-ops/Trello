import { pino, stdSerializers, stdTimeFunctions, type DestinationStream, type Logger } from 'pino'

/**
 * Структурные JSON-логи pino в stdout (§23.9). В dev читаемый вид даёт pino-pretty
 * в конвейере npm-скрипта, а не транспорт внутри процесса: образ production его не содержит.
 *
 * Redact: заголовки аутентификации и cookie, пароли, токены, секреты и строки
 * подключения. Тела запросов не логируются вообще.
 */
export const REDACT_PATHS: readonly string[] = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers["set-cookie"]',
  'password',
  'token',
  'secret',
  'secretKey',
  'connectionString',
  'databaseUrl',
  '*.password',
  '*.token',
  '*.secret',
  '*.secretKey',
  '*.accessKey',
  '*.connectionString',
  '*.databaseUrl',
  '*.redisUrl',
  '*.DATABASE_URL',
  '*.DATABASE_URL_MIGRATE',
  '*.S3_SECRET_KEY',
]

export const REDACTED = '[REDACTED]'

export interface LoggerOptions {
  readonly level: string
  readonly service: string
  /** Для тестов: куда писать вместо stdout. */
  readonly destination?: DestinationStream
}

export function createLogger(options: LoggerOptions): Logger {
  const config = {
    level: options.level,
    base: { service: options.service },
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    serializers: { err: stdSerializers.err },
  }
  return options.destination ? pino(config, options.destination) : pino(config)
}

export type { Logger }
