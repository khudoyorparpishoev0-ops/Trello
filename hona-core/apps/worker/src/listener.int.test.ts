import { appDb, readTestDbEnv, withClient, workerDatabase } from '@hona/db/testing'
import { describe, expect, it } from 'vitest'
import { memoryLogger } from '../test/logger.js'
import { createNotificationListener } from './listener.js'

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('LISTEN outbox_new', () => {
  it('receives NOTIFY and reconnects after the connection is killed', async () => {
    const database = await workerDatabase()
    let notified = 0
    const { logger, lines } = memoryLogger('info')
    const listener = createNotificationListener({
      connectionString: database.appUrl,
      onNotify: () => (notified += 1),
      log: logger,
    })
    const sender = appDb(database, 'notify-sender')
    listener.start()
    try {
      await waitFor(() => listener.isListening())
      const afterConnect = notified
      await sender.pool.query("SELECT pg_notify('outbox_new', '')")
      await waitFor(() => notified > afterConnect)

      // Разрываем соединение слушателя со стороны сервера (как при рестарте PostgreSQL).
      // Нужен суперпользователь тестов: у ролей приложения такого права нет.
      await withClient(readTestDbEnv().adminUrl, (client) =>
        client.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'hona-worker-listen' AND datname = $1",
          [database.name],
        ),
      )
      await waitFor(() => !listener.isListening())
      await waitFor(() => listener.isListening())
      const afterReconnect = notified
      await sender.pool.query("SELECT pg_notify('outbox_new', '')")
      await waitFor(() => notified > afterReconnect)
      expect(lines().filter((line) => line.msg === 'listener: listening')).toHaveLength(2)
    } finally {
      await listener.stop()
      await sender.close()
    }
  })
})
