import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Статические стражи архитектуры (§4, §5, §14, §23; регрессии v1 из §1).
 * Дополняют ESLint там, где нужен реальный путь файла или содержимое конфигов.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGES = ['apps/api', 'apps/worker', 'apps/web', 'packages/shared', 'packages/db']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.tsbuild', 'migrations'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) out.push(path)
  }
  return out
}

const IMPORT =
  /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(IMPORT)].map((match) => (match[1] ?? match[2]) as string)
}

describe('package boundaries by real path', () => {
  for (const pkg of PACKAGES) {
    it(`${pkg}: relative imports stay inside the package (and never reach legacy v1)`, () => {
      const pkgRoot = join(ROOT, pkg)
      const offenders: string[] = []
      for (const file of walk(pkgRoot)) {
        for (const spec of importsOf(file)) {
          if (!spec.startsWith('.')) continue
          const target = resolve(dirname(file), spec)
          if (!target.startsWith(pkgRoot + sep)) offenders.push(`${relative(ROOT, file)} → ${spec}`)
        }
      }
      expect(offenders).toEqual([])
    })
  }

  it('nothing in hona-core imports the legacy tree or its aliases', () => {
    const legacyRoot = resolve(ROOT, '..')
    const offenders: string[] = []
    for (const file of walk(ROOT)) {
      for (const spec of importsOf(file)) {
        if (spec.startsWith('@/') || spec.startsWith('#shared/'))
          offenders.push(`${relative(ROOT, file)} → ${spec}`)
        if (!spec.startsWith('.')) continue
        const target = resolve(dirname(file), spec)
        if (target.startsWith(legacyRoot + sep) && !target.startsWith(ROOT + sep)) {
          offenders.push(`${relative(ROOT, file)} → ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('v1 regression guards (§1 defects 1–6)', () => {
  const sources = PACKAGES.flatMap((pkg) => walk(join(ROOT, pkg)))

  it('no whole-board JSON state anywhere in the code', () => {
    const hits = sources.filter((file) => /board_state|boardState/.test(readFileSync(file, 'utf8')))
    expect(hits.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('no seed / demo data in the client or the API that could overwrite real state', () => {
    const clientAndApi = sources.filter(
      (file) => /apps\/(web|api)\/src/.test(file) && !/\.(int\.)?test\.tsx?$/.test(file),
    )
    const hits = clientAndApi.filter((file) =>
      /\bseed(Data|State|Board)?\b|demoData|DEMO_/i.test(readFileSync(file, 'utf8')),
    )
    expect(hits.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('the web client issues only GET requests in Phase 1 (no writes on page load)', () => {
    const web = sources.filter(
      (file) => file.includes(`${sep}apps${sep}web${sep}src${sep}`) && !file.includes('.test.'),
    )
    const writes = web.filter((file) =>
      /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(readFileSync(file, 'utf8')),
    )
    expect(writes.map((file) => relative(ROOT, file))).toEqual([])
  })
})

describe('configuration hygiene (§14.4, §14.6)', () => {
  it('process.env is read only in the configuration modules and test infrastructure', () => {
    const allowed = [
      'apps/api/src/core/config/env.ts',
      'apps/worker/src/config/env.ts',
      'packages/db/src/config/env.ts',
      'packages/db/src/testing/env.ts',
      'apps/web/vite.config.ts',
    ]
    const readers = PACKAGES.flatMap((pkg) => walk(join(ROOT, pkg)))
      .filter((file) => !/\.(int\.)?test\.tsx?$/.test(file) && !/[\\/]test[\\/]/.test(file))
      .filter((file) => /process\.env/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(readers.sort()).toEqual(allowed.sort())
  })

  it('dev compose publishes every port on 127.0.0.1 only', () => {
    const compose = readFileSync(join(ROOT, 'docker-compose.dev.yml'), 'utf8')
    const ports = [...compose.matchAll(/^\s*-\s*'([^']+:\d+)'\s*$/gm)].map(
      (match) => match[1] as string,
    )
    expect(ports.length).toBeGreaterThanOrEqual(5)
    for (const mapping of ports) expect(mapping).toMatch(/^127\.0\.0\.1:\d+:\d+$/)
  })

  it('.env.example contains placeholders only — no real secrets, IPs or server names', () => {
    const lines = readFileSync(join(ROOT, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
    const env = Object.fromEntries(
      lines.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    )
    for (const [key, value] of Object.entries(env)) {
      if (/PASSWORD|SECRET/.test(key)) expect(value, key).toMatch(/^change-me/)
      for (const ip of value.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [])
        expect(ip, key).toBe('127.0.0.1')
      for (const url of value.match(/[a-z]+:\/\/[^\s]+/g) ?? []) {
        const { hostname, password } = new URL(url)
        expect(['127.0.0.1', 'localhost'], key).toContain(hostname)
        if (password) expect(password, key).toMatch(/^change-me/)
      }
    }
  })
})
