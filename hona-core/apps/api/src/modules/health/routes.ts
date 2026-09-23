import { HealthResponse, ReadyResponse } from '@hona/shared'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { checkReadiness, type ReadinessDeps } from './service.js'

export interface HealthRoutesOptions {
  readonly deps: ReadinessDeps
  readonly version: string
  readonly startedAt: number
}

/**
 * `GET /health` — liveness без зависимостей и без авторизации.
 * `GET /health/ready` — readiness: PostgreSQL, Redis, MinIO; наружу только общий статус.
 */
export const healthRoutes: FastifyPluginCallbackZod<HealthRoutesOptions> = (app, options, done) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness: the process is running',
        response: { 200: HealthResponse },
      },
    },
    async (_request, reply) => {
      reply.header('cache-control', 'no-store')
      return {
        status: 'ok' as const,
        version: options.version,
        uptimeS: Math.floor((Date.now() - options.startedAt) / 1000),
      }
    },
  )

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness: PostgreSQL, Redis and object storage are reachable',
        response: { 200: ReadyResponse, 503: ReadyResponse },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const readiness = await checkReadiness(options.deps)
      if (!readiness.ready) {
        request.log.warn({ checks: readiness.checks }, 'readiness: dependency unavailable')
        return reply.code(503).send({ status: 'unavailable' as const })
      }
      request.log.debug({ checks: readiness.checks }, 'readiness: ok')
      return { status: 'ok' as const }
    },
  )

  done()
}
