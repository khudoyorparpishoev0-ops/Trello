import { pino, stdSerializers, stdTimeFunctions, type DestinationStream, type Logger } from 'pino'

/** JSON-логи воркера (§10.5, §23.9) с тем же redact, что у API. */
const REDACT_PATHS = [
  'password',
  'token',
  'secret',
  'connectionString',
  'databaseUrl',
  '*.password',
  '*.token',
  '*.secret',
  '*.connectionString',
  '*.databaseUrl',
  '*.DATABASE_URL',
]

export function createLogger(options: { level: string; destination?: DestinationStream }): Logger {
  const config = {
    level: options.level,
    base: { service: 'worker' },
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    serializers: { err: stdSerializers.err },
  }
  return options.destination ? pino(config, options.destination) : pino(config)
}

export type { Logger }
