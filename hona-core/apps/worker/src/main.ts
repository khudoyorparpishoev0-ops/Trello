import { createDb } from '@hona/db'
import { loadWorkerConfigOrExit } from './config/env.js'
import { HANDLERS } from './handlers/index.js'
import { startHealthServer } from './health.js'
import { createNotificationListener } from './listener.js'
import { createLogger } from './logger.js'
import { createOutboxWorker } from './outbox/loop.js'

/**
 * Точка входа воркера. SIGTERM/SIGINT: захват новых пачек прекращается, текущая
 * пачка дорабатывается, затем закрываются LISTEN, health и пул PostgreSQL.
 * Строки, брошенные при аварийном завершении, вернёт свип через 5 мин.
 */
const SHUTDOWN_TIMEOUT_MS = 30_000

const config = loadWorkerConfigOrExit()
const log = createLogger({ level: config.logLevel }).child({ workerId: config.workerId })

const database = createDb({
  connectionString: config.databaseUrl,
  applicationName: 'hona-worker',
  max: 10,
  onPoolError: (err) => log.warn({ err: { message: err.message } }, 'postgres: idle client error'),
})

const worker = createOutboxWorker({
  db: database.db,
  workerId: config.workerId,
  handlers: HANDLERS,
  log,
})

const listener = createNotificationListener({
  connectionString: config.databaseUrl,
  onNotify: () => worker.wake(),
  log,
})

const health = await startHealthServer({
  host: config.host,
  port: config.healthPort,
  deps: {
    lastCycleAt: () => worker.lastCycleAt(),
    pingDatabase: async () => {
      await database.pool.query('SELECT 1')
    },
  },
})

/** Один сигнал может прийти дважды (терминал и tsx watch шлют его всей группе процессов). */
const DUPLICATE_SIGNAL_WINDOW_MS = 1_000
let shutdownStartedAt: number | undefined
async function shutdown(signal: string): Promise<void> {
  if (shutdownStartedAt !== undefined) {
    if (Date.now() - shutdownStartedAt < DUPLICATE_SIGNAL_WINDOW_MS) return
    log.warn({ signal }, 'worker: repeated signal, exiting immediately')
    process.exit(1)
  }
  shutdownStartedAt = Date.now()
  log.info({ signal }, 'worker: shutdown requested')
  const guard = setTimeout(() => {
    log.error('worker: shutdown timed out')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  guard.unref()
  await worker.stop()
  await listener.stop()
  await health.close()
  await database.close()
  log.info('worker: shutdown complete')
}

process.on('SIGTERM', (signal) => void shutdown(signal))
process.on('SIGINT', (signal) => void shutdown(signal))
process.on('unhandledRejection', (reason) => {
  log.fatal({ err: reason }, 'worker: unhandled rejection')
  process.exit(1)
})

listener.start()
worker.start()
log.info({ healthPort: health.port, handlers: Object.keys(HANDLERS) }, 'worker: started')
