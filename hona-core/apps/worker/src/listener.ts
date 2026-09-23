import pg from 'pg'
import type { Logger } from './logger.js'

/**
 * LISTEN outbox_new (§10.5). NOTIFY будит воркер сразу после COMMIT эмиттера;
 * если соединение потеряно, воркер продолжает работать по опросу раз в секунду,
 * а слушатель переподключается с экспоненциальной паузой до 30 с.
 */
export const OUTBOX_CHANNEL = 'outbox_new' // совпадает с pg_notify в apps/api core/events/emit.ts

export interface NotificationListener {
  start(): void
  stop(): Promise<void>
  isListening(): boolean
}

export function createNotificationListener(options: {
  connectionString: string
  onNotify: () => void
  log: Logger
}): NotificationListener {
  let client: pg.Client | undefined
  let stopped = false
  let listening = false
  let retryMs = 1_000
  let timer: NodeJS.Timeout | undefined

  function scheduleReconnect(): void {
    listening = false
    if (stopped || timer) return
    timer = setTimeout(() => {
      timer = undefined
      void connect()
    }, retryMs)
    retryMs = Math.min(retryMs * 2, 30_000)
  }

  async function connect(): Promise<void> {
    const next = new pg.Client({
      connectionString: options.connectionString,
      application_name: 'hona-worker-listen',
    })
    client = next
    next.on('notification', (message) => {
      if (message.channel === OUTBOX_CHANNEL) options.onNotify()
    })
    next.on('error', (err) => {
      options.log.warn({ err: { message: err.message } }, 'listener: connection error')
      void next.end().catch(() => undefined)
      scheduleReconnect()
    })
    next.on('end', () => {
      if (!stopped) scheduleReconnect()
    })
    try {
      await next.connect()
      await next.query('LISTEN outbox_new')
      listening = true
      retryMs = 1_000
      options.log.info({ channel: OUTBOX_CHANNEL }, 'listener: listening')
      // Пока соединения не было, NOTIFY могли потеряться — пусть цикл проверит очередь.
      options.onNotify()
    } catch (err) {
      options.log.warn(
        { err: { message: err instanceof Error ? err.message : String(err) } },
        'listener: connect failed',
      )
      void next.end().catch(() => undefined)
      scheduleReconnect()
    }
  }

  return {
    start() {
      stopped = false
      void connect()
    },
    async stop() {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = undefined
      listening = false
      await client?.end().catch(() => undefined)
    },
    isListening: () => listening,
  }
}
