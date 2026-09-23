import { hostname } from 'node:os'
import { z } from 'zod'

/**
 * Конфигурация воркера (§23.9). Единственное место чтения `process.env` в воркере.
 * Ошибка печатает имена переменных без значений.
 */
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const PLACEHOLDER_MARKERS = ['change-me', 'changeme', 'example', 'password']

const WorkerEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: z.string().trim().min(1).default('127.0.0.1'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
    WORKER_ID: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{1,64}$/, { error: 'must be 1-64 chars [A-Za-z0-9._-]' })
      .optional(),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return
    const password = new URL(env.DATABASE_URL).password.toLowerCase()
    if (password === '' || PLACEHOLDER_MARKERS.some((marker) => password.includes(marker))) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'placeholder secret in production',
      })
    }
  })

export interface WorkerConfig {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly host: string
  readonly logLevel: (typeof LOG_LEVELS)[number]
  readonly databaseUrl: string
  readonly workerId: string
  readonly healthPort: number
}

export class WorkerConfigError extends Error {
  constructor(readonly issues: readonly { variable: string; problem: string }[]) {
    super(`Invalid environment: ${issues.map((i) => `${i.variable} (${i.problem})`).join(', ')}`)
    this.name = 'WorkerConfigError'
  }
}

export function loadWorkerConfig(source: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = WorkerEnv.safeParse(source)
  if (!parsed.success) {
    throw new WorkerConfigError(
      parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? 'environment'),
        problem: issue.message,
      })),
    )
  }
  const env = parsed.data
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    workerId: env.WORKER_ID ?? `${hostname()}-${process.pid}`,
    healthPort: env.WORKER_HEALTH_PORT,
  })
}

export function loadWorkerConfigOrExit(source: NodeJS.ProcessEnv = process.env): WorkerConfig {
  try {
    return loadWorkerConfig(source)
  } catch (err) {
    if (!(err instanceof WorkerConfigError)) throw err
    process.stderr.write(
      `${JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: 'invalid environment', issues: err.issues })}\n`,
    )
    process.exit(1)
  }
}
