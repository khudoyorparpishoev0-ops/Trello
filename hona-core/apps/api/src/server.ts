import { readFileSync } from 'node:fs'
import closeWithGrace from 'close-with-grace'
import { buildApp } from './app.js'
import { loadConfigOrExit } from './core/config/env.js'
import { createLogger } from './core/logger.js'

/**
 * Точка входа API. Конфиг проверяется до старта; недоступность PostgreSQL, Redis или
 * MinIO на старте не роняет процесс — это состояние readiness (503), а не crash-loop.
 * SIGTERM/SIGINT: Fastify перестаёт принимать запросы, дожидается текущих, затем
 * закрываются PostgreSQL и Redis (§23.9).
 */
const config = loadConfigOrExit()
const logger = createLogger({ level: config.logLevel, service: 'api' })

function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version?: unknown }
  return typeof manifest.version === 'string' ? manifest.version : '0.0.0'
}

const app = await buildApp(config, { logger, version: readVersion() })

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) logger.error({ err }, 'api: fatal error, shutting down')
  else logger.info({ signal }, 'api: shutdown requested')
  await app.close()
  logger.info('api: shutdown complete')
})

try {
  await app.listen({ host: config.host, port: config.port })
  logger.info({ host: config.host, port: config.port, env: config.nodeEnv }, 'api: listening')
} catch (err) {
  logger.fatal({ err }, 'api: failed to start')
  process.exit(1)
}
