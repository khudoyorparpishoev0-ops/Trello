import { readFile, writeFile } from 'node:fs/promises'
import { pino } from 'pino'
import { buildApp } from '../src/app.js'
import type { AppConfig } from '../src/core/config/env.js'

/**
 * OpenAPI 3.1 из zod-контрактов (§9.1). `--write` обновляет docs/api/openapi.json,
 * `--check` падает, если закоммиченный файл расходится с кодом (CI job openapi).
 * Конфиг — заглушки: фабрика не открывает соединений, генерации сеть не нужна.
 */
const TARGET = new URL('../../../docs/api/openapi.json', import.meta.url)

const config: AppConfig = Object.freeze({
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 0,
  appOrigin: 'http://localhost:5173',
  logLevel: 'silent',
  trustProxy: false,
  databaseUrl: 'postgres://openapi@127.0.0.1:1/openapi',
  redisUrl: 'redis://127.0.0.1:1',
  s3: {
    endpoint: 'http://127.0.0.1:1',
    publicEndpoint: 'http://localhost:1',
    region: 'us-east-1',
    bucket: 'openapi',
    accessKey: 'openapi',
    secretKey: 'openapi-generation-only',
  },
})

const mode = process.argv[2]
if (mode !== '--write' && mode !== '--check') {
  process.stderr.write('usage: openapi.ts --write | --check\n')
  process.exit(2)
}

const app = await buildApp(config, { logger: pino({ level: 'silent' }), version: 'openapi' })
await app.ready()
const generated = `${JSON.stringify(app.swagger(), null, 2)}\n`
await app.close()

if (mode === '--write') {
  await writeFile(TARGET, generated)
  process.stdout.write('docs/api/openapi.json updated\n')
} else {
  const committed = await readFile(TARGET, 'utf8').catch(() => '')
  if (committed !== generated) {
    process.stderr.write(
      'docs/api/openapi.json is out of date with the API contracts. Run: npm run openapi:generate\n',
    )
    process.exit(1)
  }
  process.stdout.write('docs/api/openapi.json matches the API contracts\n')
}
