#!/usr/bin/env node
// HONA Core 2.0 — локальная разработка: api, worker и web одной командой (§23.11 п.2).
//
//   npm run dev
//
// .env разбирается средствами Node (process.loadEnvFile), shell его не source-ит.
// Каждый процесс — своя группа, чтобы Ctrl+C терминала не приходил им напрямую.
// Остановка: SIGTERM прямому потомку (tsx watch передаёт его api/worker — graceful
// shutdown), через 15 с — SIGKILL всей группе, чтобы ничего не осталось висеть.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envFile = join(root, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
else
  console.warn('[dev] .env not found — copy .env.example to .env first (see docs/development.md)')

const bin = (name) => join(root, 'node_modules', '.bin', name)
const pretty = bin('pino-pretty')
const services = [
  {
    name: 'api',
    cwd: 'apps/api',
    cmd: bin('tsx'),
    args: ['watch', '--conditions=source', 'src/server.ts'],
    pretty: true,
  },
  {
    name: 'worker',
    cwd: 'apps/worker',
    cmd: bin('tsx'),
    args: ['watch', '--conditions=source', 'src/main.ts'],
    pretty: true,
  },
  { name: 'web', cwd: 'apps/web', cmd: bin('vite'), args: [], pretty: false },
]

const children = []
let stopping = false

function prefix(name, stream, target) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) target.write(`[${name}] ${line}\n`)
  })
}

for (const service of services) {
  const child = spawn(service.cmd, service.args, {
    cwd: join(root, service.cwd),
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push({ ...service, child })
  let out = child.stdout
  if (service.pretty && existsSync(pretty)) {
    const formatter = spawn(
      pretty,
      ['--colorize', '--translateTime', 'SYS:HH:MM:ss.l', '--ignore', 'pid,hostname'],
      {
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    )
    child.stdout.pipe(formatter.stdin)
    out = formatter.stdout
  }
  prefix(service.name, out, process.stdout)
  prefix(service.name, child.stderr, process.stderr)
  child.on('exit', (code, signal) => {
    console.log(`[dev] ${service.name} exited (${signal ?? code})`)
    if (!stopping) shutdown('SIGTERM', 1)
  })
}

function shutdown(signal, exitCode = 0) {
  if (stopping) return
  stopping = true
  console.log(`[dev] stopping (${signal})…`)
  for (const { child } of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  const force = setTimeout(() => {
    for (const { child } of children) {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        /* уже завершён */
      }
    }
    process.exit(1)
  }, 15_000)
  force.unref()
  Promise.all(
    children.map(({ child }) =>
      child.exitCode !== null ? null : new Promise((r) => child.once('exit', r)),
    ),
  ).then(() => process.exit(exitCode))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
