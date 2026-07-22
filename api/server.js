// API IT-HONA TaskBoard.
// Хранение доски в PostgreSQL + вход по логину (общий логин/пароль из .env).
// Пока AUTH_PASSWORD пуст — доступ открыт (вход не требуется). Задан — включается
// защита: /api/board требует валидную сессию (cookie sid).

import http from 'node:http'
import crypto from 'node:crypto'
import pg from 'pg'
import Redis from 'ioredis'

const PORT = Number(process.env.PORT ?? 3000)
const AUTH_LOGIN = process.env.AUTH_LOGIN || 'admin'
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? ''
const AUTH_REQUIRED = AUTH_PASSWORD.length > 0
const SESSION_DAYS = 30
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
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function initWithRetry() {
  for (let i = 0; i < 30; i++) {
    try {
      await ensureSchema()
      console.log(`[api] схема БД готова · вход ${AUTH_REQUIRED ? 'включён' : 'выключен'}`)
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

function json(res, code, payload, headers) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(payload))
}

function parseCookies(req) {
  const out = {}
  const h = req.headers.cookie || ''
  for (const part of h.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

async function hasValidSession(req) {
  if (!AUTH_REQUIRED) return true
  const sid = parseCookies(req).sid
  if (!sid) return false
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions WHERE token = $1 AND created_at > now() - interval '${SESSION_DAYS} days'`,
    [sid],
  )
  return rows.length > 0
}

// ——— Роуты ———
async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const path = url.pathname

  // Здоровье
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
    return json(res, ok ? 200 : 503, { service: 'ithona-taskboard-api', status: ok ? 'ok' : 'degraded', checks })
  }

  // Кто я / нужен ли вход
  if (path === '/api/auth/me' && req.method === 'GET') {
    const authed = await hasValidSession(req)
    return json(res, 200, { authRequired: AUTH_REQUIRED, authenticated: AUTH_REQUIRED ? authed : true })
  }

  // Вход
  if (path === '/api/auth/login' && req.method === 'POST') {
    if (!AUTH_REQUIRED) return json(res, 200, { ok: true })
    const body = await readBody(req)
    let creds = {}
    try {
      creds = JSON.parse(body)
    } catch {
      return json(res, 400, { error: 'bad_request' })
    }
    const okLogin = safeEqual(creds.login ?? '', AUTH_LOGIN)
    const okPass = safeEqual(creds.password ?? '', AUTH_PASSWORD)
    if (!okLogin || !okPass) return json(res, 401, { error: 'invalid_credentials' })
    const token = crypto.randomBytes(24).toString('hex')
    await pool.query('INSERT INTO sessions (token) VALUES ($1)', [token])
    const cookie = `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}`
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie })
  }

  // Выход
  if (path === '/api/auth/logout' && req.method === 'POST') {
    const sid = parseCookies(req).sid
    if (sid) await pool.query('DELETE FROM sessions WHERE token = $1', [sid]).catch(() => {})
    const cookie = 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie })
  }

  // Доска (защищена, если включён вход)
  if (path === '/api/board') {
    if (!(await hasValidSession(req))) return json(res, 401, { error: 'unauthorized' })
    if (req.method === 'GET') {
      const { rows } = await pool.query("SELECT data FROM board_state WHERE id = 'default'")
      return json(res, 200, rows[0] ? rows[0].data : null)
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req)
      JSON.parse(body)
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
