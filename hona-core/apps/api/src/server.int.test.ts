import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { workerDatabase } from '@hona/db/testing'
import { describe, expect, it } from 'vitest'
import { childEnv } from '../test/integration.js'

/** Запуск и graceful shutdown настоящего процесса API (§23.9). */
async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as { port: number }
  server.close()
  return port
}

describe('api process', () => {
  it('starts, serves health, and exits 0 on SIGTERM after closing connections', async () => {
    const db = await workerDatabase()
    const port = await freePort()
    const child = spawn(
      process.execPath,
      [
        '--conditions=source',
        '--import',
        'tsx',
        fileURLToPath(new URL('./server.ts', import.meta.url)),
      ],
      {
        env: childEnv({ PORT: String(port), HOST: '127.0.0.1', DATABASE_URL: db.appUrl }),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))

    const deadline = Date.now() + 20_000
    while (!output.includes('api: listening')) {
      if (Date.now() > deadline || child.exitCode !== null)
        throw new Error(`api did not start:\n${output}`)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`)
    expect(health.status).toBe(200)
    const ready = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`)
    expect(ready.status).toBe(200)

    child.kill('SIGTERM')
    const [code] = (await once(child, 'exit')) as [number | null]
    expect(code).toBe(0)
    expect(output).toContain('api: shutdown requested')
    expect(output).toContain('api: shutdown complete')
    expect(output).not.toMatch(/password|secret/i)
  })

  it('refuses to start with an invalid environment and names only the variables', async () => {
    const child = spawn(
      process.execPath,
      [
        '--conditions=source',
        '--import',
        'tsx',
        fileURLToPath(new URL('./server.ts', import.meta.url)),
      ],
      {
        env: {
          PATH: process.env.PATH ?? '',
          NODE_ENV: 'test',
          DATABASE_URL: 'mysql://u:leaky-secret-77@h/db',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    const [code] = (await once(child, 'exit')) as [number | null]
    expect(code).toBe(1)
    expect(output).toContain('invalid environment')
    expect(output).toContain('DATABASE_URL')
    expect(output).toContain('APP_ORIGIN')
    expect(output).not.toContain('leaky-secret-77')
  })
})
