import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * HTTP health воркера на внутреннем порту (§23.9): 200, если последний цикл
 * не старше 30 с и PostgreSQL отвечает; иначе 503. Наружу только общий статус.
 */
export const MAX_CYCLE_AGE_MS = 30_000

export interface WorkerHealthDeps {
  lastCycleAt(): number | null
  pingDatabase(): Promise<void>
  now?: () => number
}

export async function isWorkerHealthy(deps: WorkerHealthDeps): Promise<boolean> {
  const last = deps.lastCycleAt()
  const now = deps.now ? deps.now() : Date.now()
  if (last === null || now - last > MAX_CYCLE_AGE_MS) return false
  try {
    await deps.pingDatabase()
    return true
  } catch {
    return false
  }
}

export interface HealthServer {
  readonly port: number
  close(): Promise<void>
}

export async function startHealthServer(options: {
  host: string
  port: number
  deps: WorkerHealthDeps
}): Promise<HealthServer> {
  const server: Server = createServer((req, res) => {
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'GET' || req.url !== '/health') {
      send(404, { status: 'not_found' })
      return
    }
    isWorkerHealthy(options.deps).then(
      (healthy) => send(healthy ? 200 : 503, { status: healthy ? 'ok' : 'unavailable' }),
      () => send(503, { status: 'unavailable' }),
    )
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, () => resolve())
  })
  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}
