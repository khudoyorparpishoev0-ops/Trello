import { z } from 'zod'

/**
 * Конфигурация API (§14.4, §23.9). ЕДИНСТВЕННОЕ место чтения `process.env` в API —
 * остальное запрещено lint-правилом. Конфиг проверяется zod на старте, замораживается
 * и передаётся в `buildApp(config)`. Неполное окружение → процесс не стартует и
 * печатает имена переменных без значений.
 */

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const

/** Подстроки, по которым видно, что значение — плейсхолдер из .env.example. */
const PLACEHOLDER_MARKERS = ['change-me', 'changeme', 'example', 'minioadmin', 'password']

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' })
const httpUrl = z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' })

/** TRUST_PROXY: false | true | число хопов | список IP/CIDR через запятую. */
const trustProxy = z
  .string()
  .trim()
  .default('false')
  .transform((raw): boolean | number | string[] => {
    if (raw === 'false' || raw === '') return false
    if (raw === 'true') return true
    if (/^\d+$/.test(raw)) return Number(raw)
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  })

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: z.string().trim().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    APP_ORIGIN: httpUrl,
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    TRUST_PROXY: trustProxy,
    DATABASE_URL: postgresUrl,
    REDIS_URL: z.url({ protocol: /^rediss?$/, error: 'must be a redis:// URL' }),
    S3_ENDPOINT: httpUrl,
    S3_PUBLIC_ENDPOINT: httpUrl,
    S3_REGION: z.string().trim().min(1),
    S3_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, { error: 'must be a valid bucket name' }),
    S3_ACCESS_KEY: z.string().min(3),
    S3_SECRET_KEY: z.string().min(8),
  })
  .superRefine((env, ctx) => {
    const origin = new URL(env.APP_ORIGIN)
    if (origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'must be an origin without path',
      })
    }
    if (env.NODE_ENV !== 'production') return
    // Production: только https снаружи и никаких плейсхолдеров из .env.example.
    for (const key of ['APP_ORIGIN', 'S3_PUBLIC_ENDPOINT'] as const) {
      if (!env[key].startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'must use https in production' })
      }
    }
    const secrets = {
      DATABASE_URL: new URL(env.DATABASE_URL).password,
      S3_SECRET_KEY: env.S3_SECRET_KEY,
    }
    for (const [key, value] of Object.entries(secrets)) {
      const lower = value.toLowerCase()
      if (value === '' || PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker))) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'placeholder secret in production' })
      }
    }
  })

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly host: string
  readonly port: number
  readonly appOrigin: string
  readonly logLevel: (typeof LOG_LEVELS)[number]
  readonly trustProxy: boolean | number | readonly string[]
  readonly databaseUrl: string
  readonly redisUrl: string
  readonly s3: {
    readonly endpoint: string
    readonly publicEndpoint: string
    readonly region: string
    readonly bucket: string
    readonly accessKey: string
    readonly secretKey: string
  }
}

export interface ConfigIssue {
  readonly variable: string
  readonly problem: string
}

/** Ошибка конфигурации: только имена переменных и описание проблемы, без значений. */
export class ConfigError extends Error {
  constructor(readonly issues: readonly ConfigIssue[]) {
    super(
      `Invalid environment: ${issues.map((issue) => `${issue.variable} (${issue.problem})`).join(', ')}`,
    )
    this.name = 'ConfigError'
  }
}

function deepFreeze<T extends object>(value: T): T {
  for (const nested of Object.values(value)) {
    if (nested !== null && typeof nested === 'object') deepFreeze(nested as object)
  }
  return Object.freeze(value)
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? 'environment'),
        // Сообщения zod 4 и наши refine не содержат входных значений.
        problem: issue.message,
      })),
    )
  }
  const env = parsed.data
  return deepFreeze({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    appOrigin: new URL(env.APP_ORIGIN).origin,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    s3: {
      endpoint: env.S3_ENDPOINT,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
    },
  })
}

/** Для server.ts: печатает имена проблемных переменных и завершает процесс с кодом 1. */
export function loadConfigOrExit(source: NodeJS.ProcessEnv = process.env): AppConfig {
  try {
    return loadConfig(source)
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err
    process.stderr.write(
      `${JSON.stringify({ time: new Date().toISOString(), level: 'fatal', msg: 'invalid environment', issues: err.issues })}\n`,
    )
    process.exit(1)
  }
}
