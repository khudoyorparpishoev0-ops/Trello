import { once } from 'node:events'
import { createConnection, createServer, type Server, type Socket } from 'node:net'

/**
 * Управляемый TCP-прокси для тестов отказа зависимости: `down()` рвёт все
 * соединения и перестаёт принимать новые, `up()` снова слушает тот же порт.
 * Позволяет проверить 503 и восстановление readiness в одном процессе API.
 */
export interface TcpProxy {
  readonly port: number
  down(): Promise<void>
  up(): Promise<void>
  close(): Promise<void>
}

export async function startTcpProxy(targetHost: string, targetPort: number): Promise<TcpProxy> {
  const sockets = new Set<Socket>()
  let server: Server | undefined
  let port = 0

  async function listen(): Promise<void> {
    server = createServer((client) => {
      const upstream = createConnection({ host: targetHost, port: targetPort })
      sockets.add(client).add(upstream)
      const drop = () => {
        client.destroy()
        upstream.destroy()
        sockets.delete(client)
        sockets.delete(upstream)
      }
      client.on('error', drop).on('close', drop)
      upstream.on('error', drop).on('close', drop)
      client.pipe(upstream).pipe(client)
    })
    server.listen(port, '127.0.0.1')
    await once(server, 'listening')
    port = (server.address() as { port: number }).port
  }

  async function down(): Promise<void> {
    for (const socket of sockets) socket.destroy()
    sockets.clear()
    if (server) {
      const closing = once(server, 'close')
      server.close()
      await closing
      server = undefined
    }
  }

  await listen()
  return {
    get port() {
      return port
    },
    down,
    up: listen,
    close: down,
  }
}
