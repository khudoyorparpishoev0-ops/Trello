import swagger from '@fastify/swagger'
import { isValidRequestId } from '@hona/shared'
import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { AppConfig } from './core/config/env.js'
import { httpRequestContext, type RequestContext } from './core/context.js'
import { createDatabase } from './core/db.js'
import { AppError, mapError } from './core/errors.js'
import { newRequestId } from './core/ids.js'
import { createLogger, type Logger } from './core/logger.js'
import { closeRedis, createRedis } from './core/redis.js'
import { createS3 } from './core/s3.js'
import { healthRoutes } from './modules/health/routes.js'
import { registerSecurity } from './plugins/security.js'

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext
  }
}

/** Экземпляр приложения: HTTP/1.1, логгер pino, контракты zod. */
export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>

/** Лимит тела запроса (§9.2, §14.3): больше 1 МБ → 413. Файлы идут мимо API. */
export const BODY_LIMIT_BYTES = 1_048_576

/** Число хопов переводится в функцию: тип Fastify его не описывает, хотя proxy-addr умеет. */
function toFastifyTrustProxy(
  value: AppConfig['trustProxy'],
): boolean | string[] | ((address: string, hop: number) => boolean) {
  if (typeof value === 'number') return (_address, hop) => hop < value
  if (typeof value === 'boolean') return value
  return [...value]
}

export interface BuildAppOptions {
  readonly logger?: Logger
  readonly version?: string
}

/**
 * Фабрика приложения (§4): одна и та же для сервера, тестов (`app.inject()`) и
 * генерации OpenAPI. Соединения с зависимостями ленивые — фабрика ничего не открывает.
 */
export async function buildApp(config: AppConfig, options: BuildAppOptions = {}): Promise<App> {
  const logger: FastifyBaseLogger =
    options.logger ?? createLogger({ level: config.logLevel, service: 'api' })
  const startedAt = Date.now()

  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: toFastifyTrustProxy(config.trustProxy),
    // x-request-id от прокси принимается только в валидном формате (§23.9)
    requestIdHeader: false,
    genReqId: (req) => {
      const incoming = req.headers['x-request-id']
      return isValidRequestId(incoming) ? incoming : newRequestId()
    },
    // Своя строка «request completed» в onResponse (§23.9): route, statusCode, responseTimeMs
    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: true,
    }),
    return503OnClosing: true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const deps = {
    db: createDatabase(config, logger),
    redis: createRedis(config, logger),
    s3: createS3(config),
    bucket: config.s3.bucket,
  }
  app.addHook('onClose', async () => {
    await Promise.allSettled([deps.db.close(), closeRedis(deps.redis)])
    deps.s3.destroy()
  })

  app.decorateRequest('ctx', null as unknown as RequestContext)
  app.addHook('onRequest', async (request, reply) => {
    request.ctx = httpRequestContext(request.id, request.log)
    reply.header('x-request-id', request.id)
  })
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? null
    const entry = {
      route,
      method: request.method,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }
    // Health опрашивается часто — на уровне debug, чтобы не забивать лог.
    if (route?.startsWith('/api/v1/health')) request.log.debug(entry, 'request completed')
    else request.log.info(entry, 'request completed')
  })

  await registerSecurity(app, config)

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'HONA Core API',
        version: 'v1',
        description:
          'HONA Core 2.0 REST API. Phase 1 exposes only system endpoints; business modules arrive in later phases.',
      },
      tags: [{ name: 'system', description: 'Liveness and readiness' }],
    },
    transform: jsonSchemaTransform,
  })

  app.setNotFoundHandler(() => {
    throw new AppError('NOT_FOUND', 'Route not found')
  })

  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error, request.id)
    if (mapped.internal) request.log.error({ err: error }, 'request failed')
    else request.log.info({ code: mapped.body.error.code }, 'request rejected')
    return reply.code(mapped.statusCode).send(mapped.body)
  })

  await app.register(healthRoutes, {
    prefix: '/api/v1',
    deps,
    version: options.version ?? '0.0.0',
    startedAt,
  })

  return app
}
