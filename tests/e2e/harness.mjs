/**
 * Обвязка E2E: статическая раздача dist + подстановка ответов API + браузер.
 * Playwright берётся из зависимостей проекта, а если его там нет — из
 * глобальной установки (переменная PLAYWRIGHT_PATH или /opt/node22).
 */
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = join(ROOT, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
}

const CANDIDATES = [
  process.env.PLAYWRIGHT_PATH,
  join(ROOT, 'node_modules', 'playwright', 'index.mjs'),
  join(ROOT, 'node_modules', '@playwright', 'test', 'index.js'),
  '/opt/node22/lib/node_modules/playwright/index.mjs',
].filter(Boolean)

export async function loadPlaywright() {
  for (const p of CANDIDATES) {
    if (existsSync(p)) return import(p)
  }
  throw new Error(
    'Playwright не найден. Установите: npm i -D playwright  (либо задайте PLAYWRIGHT_PATH)',
  )
}

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean)

function chromiumPath() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p
  return undefined // Playwright возьмёт свой браузер
}

/** Поднять статический сервер над dist. Возвращает { base, close }. */
export async function serveDist() {
  if (!existsSync(DIST)) throw new Error('Нет каталога dist — выполните npm run build')
  const server = http.createServer(async (q, r) => {
    try {
      let p = normalize(decodeURIComponent((q.url ?? '/').split('?')[0]))
      if (p === '/') p = '/index.html'
      let f = join(DIST, p)
      try {
        if ((await stat(f)).isDirectory()) f = join(f, 'index.html')
      } catch {
        f = join(DIST, 'index.html') // SPA-fallback
      }
      r.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' })
      r.end(await readFile(f))
    } catch {
      r.writeHead(404).end('not found')
    }
  })
  await new Promise((res) => server.listen(0, res))
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((res) => server.close(res)),
  }
}

/** Ответы API по умолчанию: открытый доступ, пустая доска (используется сид). */
export function defaultRoutes(overrides = {}) {
  return async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    const send = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) })
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        const r = await handler(route, send)
        if (r !== undefined) return r
        return
      }
    }
    if (url.includes('/api/auth/me'))
      return send({ authRequired: false, accountsEnabled: false, authenticated: true, user: null })
    if (url.includes('/api/users')) return send({ users: [] })
    if (url.includes('/api/telegram/status')) return send({ enabled: false, linked: false, botUsername: '' })
    if (url.includes('/api/board') && method === 'GET') return send(null)
    return send({ ok: true })
  }
}

/** Запустить браузер (chromium по умолчанию; BROWSER=firefox|webkit). */
export async function launch(kind = process.env.BROWSER || 'chromium') {
  const pw = await loadPlaywright()
  const engine = pw[kind] ?? pw.chromium
  const opts = kind === 'chromium' ? { executablePath: chromiumPath() } : {}
  return engine.launch(opts)
}

/** Мини-набор утверждений с накоплением результата. */
export function createReporter(title) {
  const failures = []
  let passed = 0
  console.log(`\n▸ ${title}`)
  return {
    check(cond, msg) {
      if (cond) {
        passed += 1
        console.log('  ✓ ' + msg)
      } else {
        failures.push(msg)
        console.log('  ✗ ' + msg)
      }
    },
    section(name) {
      console.log(`  — ${name} —`)
    },
    get failures() {
      return failures
    },
    get passed() {
      return passed
    },
  }
}

/** Шум окружения (нет доступа к шрифтам Google в изолированной среде). */
export const isNoise = (text) => /fonts\.g|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED/.test(text)
