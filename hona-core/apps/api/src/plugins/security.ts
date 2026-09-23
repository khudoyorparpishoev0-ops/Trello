import helmet from '@fastify/helmet'
import type { FastifyRequest } from 'fastify'
import type { App } from '../app.js'
import type { AppConfig } from '../core/config/env.js'
import { AppError } from '../core/errors.js'

/**
 * Безопасность HTTP-уровня (§14.3):
 *   • заголовки через @fastify/helmet: API отдаёт только JSON, поэтому CSP максимально
 *     строгий (`default-src 'none'`); CSP веб-приложения задаёт его сервер статики;
 *   • CSRF: на всех не-GET запросах `Origin` должен совпадать с APP_ORIGIN, либо
 *     `Sec-Fetch-Site: same-origin`. Нет ни того, ни другого или чужой origin → 403.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function assertSameOrigin(request: FastifyRequest, appOrigin: string): void {
  if (SAFE_METHODS.has(request.method)) return
  const origin = request.headers.origin
  if (origin !== undefined) {
    if (origin === appOrigin) return
    throw new AppError('FORBIDDEN_ORIGIN', 'Cross-origin request rejected')
  }
  if (request.headers['sec-fetch-site'] === 'same-origin') return
  throw new AppError('FORBIDDEN_ORIGIN', 'Origin header is required for this request')
}

export async function registerSecurity(app: App, config: AppConfig): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: false },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    xFrameOptions: { action: 'deny' },
  })
  app.addHook('onRequest', (request, _reply, done) => {
    try {
      assertSameOrigin(request, config.appOrigin)
      done()
    } catch (err) {
      done(err as Error)
    }
  })
  app.addHook('onSend', (_request, reply, payload, done) => {
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()')
    done(null, payload)
  })
}
