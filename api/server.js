// API IT-HONA TaskBoard.
// Этап «Сохранение данных»: доска хранится в PostgreSQL (как JSON-документ),
// фронтенд загружает её при старте и сохраняет изменения. Вход/пользователи —
// следующий этап. Redis используется для health-check; хранилище файлов — позже.

import http from 'node:http'
import pg from 'pg'
import Redis from 'ioredis'

const PORT = Number(process.env.PORT ?? 3000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 4000,
})

const redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
})

// ——— Схема ———
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_state (
      id         text PRIMARY KEY,
      data       jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

// Ждём готовности БД (контейнер postgres может стартовать чуть позже).
async function initWithRetry() {
  for (let i = 0; i < 30; i++) {
    try {
      await ensureSchema()
      console.log('[api] схема БД готова')
      return
    } catch (e) {
      console.log(`[api] жду БД… (${e.code ?? e.message})`)
      await sleep(2000)
    }
  }
  console.error('[api] БД не поднялась за отведённое время')
}

// ——— Утилиты ———
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 8_000_000) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      data += c
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

// ——— Роуты ———
async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const path = url.pathname

  if (path === '/api/health' || path === '/health') {
    const checks = {}
    try {
      await pool.query('SELECT 1')
      checks.postgres = 'up'
    } catch {
      checks.postgres = 'down'
    }
    try {
      if (redis.status !== 'ready') await redis.connect()
      await redis.ping()
      checks.redis = 'up'
    } catch {
      checks.redis = 'down'
    }
    const ok = checks.postgres === 'up'
    return json(res, ok ? 200 : 503, {
      service: 'ithona-taskboard-api',
      status: ok ? 'ok' : 'degraded',
      checks,
      time: new Date().toISOString(),
    })
  }

  if (path === '/api/board') {
    if (req.method === 'GET') {
      const { rows } = await pool.query("SELECT data FROM board_state WHERE id = 'default'")
      return json(res, 200, rows[0] ? rows[0].data : null)
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req)
      JSON.parse(body) // валидация: только корректный JSON
      await pool.query(
        `INSERT INTO board_state (id, data) VALUES ('default', $1::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, updated_at = now()`,
        [body],
      )
      return json(res, 200, { ok: true })
    }
    return json(res, 405, { error: 'method_not_allowed' })
  }

  return json(res, 404, { error: 'not_found' })
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('[api] ошибка запроса:', err.message)
    json(res, 500, { error: 'internal_error' })
  })
})

server.listen(PORT, () => console.log(`[api] IT-HONA TaskBoard API слушает :${PORT}`))
initWithRetry()

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close()
    pool.end().catch(() => {})
    redis.quit().catch(() => {})
    process.exit(0)
  })
}
