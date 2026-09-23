import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { workerDatabase } from '@hona/db/testing'
import { describe, expect, it } from 'vitest'

/** Запуск, health и graceful shutdown настоящего процесса воркера (§23.9). */
async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as { port: number }
  server.close()
  return port
}

describe('worker process', () => {
  it('starts, reports healthy, and exits 0 on SIGTERM', async () => {
    const database = await workerDatabase()
    const port = await freePort()
    const child = spawn(
      process.execPath,
      [
        '--conditions=source',
        '--import',
        'tsx',
        fileURLToPath(new URL('./main.ts', import.meta.url)),
      ],
      {
        env: {
          PATH: process.env.PATH ?? '',
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
          DATABASE_URL: database.appUrl,
          WORKER_ID: 'spawned-worker',
          WORKER_HEALTH_PORT: String(port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))

    const deadline = Date.now() + 20_000
    for (;;) {
      if (child.exitCode !== null || Date.now() > deadline)
        throw new Error(`worker did not become healthy:\n${output}`)
      const res = await fetch(`http://127.0.0.1:${port}/health`).catch(() => null)
      if (res?.status === 200) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    child.kill('SIGTERM')
    const [code] = (await once(child, 'exit')) as [number | null]
    expect(code).toBe(0)
    expect(output).toContain('worker: started')
    expect(output).toContain('worker: shutdown complete')
    expect(output).not.toContain(database.appUrl)
  })
})
