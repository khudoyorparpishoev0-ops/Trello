// API IT-HONA TaskBoard.
// - Хранение доски в PostgreSQL (GET/PUT /api/board)
// - Аутентификация. Два режима:
//     Личные аккаунты — если задан INVITE_CODE (регистрация по коду, у каждого свой вход).
//     Общий вход      — иначе, если задан AUTH_PASSWORD (один логин/пароль на всех).
//     Открытый доступ  — если ничего не задано.
// Пароли хешируются (scrypt + соль). Сессии — cookie sid (HttpOnly, 30 дней).

import http from 'node:http'
import crypto from 'node:crypto'
import pg from 'pg'
import Redis from 'ioredis'

const PORT = Number(process.env.PORT ?? 3000)
const INVITE_CODE = process.env.INVITE_CODE ?? ''
const ACCOUNTS = INVITE_CODE.length > 0
const AUTH_LOGIN = process.env.AUTH_LOGIN || 'admin'
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? ''
const SHARED = !ACCOUNTS && AUTH_PASSWORD.length > 0
const AUTH_REQUIRED = ACCOUNTS || SHARED
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
  await pool.query(`CREATE TABLE IF NOT EXISTS board_state (
    id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`)
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    login text UNIQUE NOT NULL,
    name text NOT NULL,
    initials text NOT NULL,
    color text NOT NULL,
    role text NOT NULL DEFAULT 'member',
    pass_salt text NOT NULL,
    pass_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now())`)
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`)
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS position text`)
}

async function initWithRetry() {
  for (let i = 0; i < 30; i++) {
    try {
      await ensureSchema()
      const mode = ACCOUNTS ? 'личные аккаунты' : SHARED ? 'общий вход' : 'открытый'
      console.log(`[api] схема БД готова · режим: ${mode}`)
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
  for (const part of (req.headers.cookie || '').split(';')) {
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
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
  return { salt, hash }
}
function verifyPassword(pw, salt, hash) {
  const h = crypto.scryptSync(pw, salt, 64).toString('hex')
  return safeEqual(h, hash)
}
function initialsFrom(name) {
  const parts = name.trim().split(/\s+/)
  const a = (parts[0] || '')[0] || ''
  const b = (parts[1] || '')[0] || ''
  return (a + b).toUpperCase() || 'U'
}
const PALETTE = ['#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444']
function colorFor(s) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// ——— Сессии / текущий пользователь ———
async function newSession(userId) {
  const token = crypto.randomBytes(24).toString('hex')
  await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId])
  return `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}`
}
async function currentUser(req) {
  const sid = parseCookies(req).sid
  if (!sid) return null
  const { rows } = await pool.query(
    `SELECT user_id FROM sessions WHERE token = $1 AND created_at > now() - interval '${SESSION_DAYS} days'`,
    [sid],
  )
  if (!rows.length) return null
  const userId = rows[0].user_id
  if (userId) {
    const u = await pool.query(
      'SELECT id, login, name, initials, color, role, department, birthday, email, position FROM users WHERE id = $1',
      [userId],
    )
    return u.rows[0] ?? null
  }
  return { shared: true, name: 'Администратор', initials: 'АД', color: '#16A34A', role: 'admin' }
}
function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    initials: u.initials,
    color: u.color,
    role: u.role,
    department: u.department ?? '',
    birthday: u.birthday ?? '',
    email: u.email ?? '',
    position: u.position ?? '',
    shared: !!u.shared,
  }
}

// ——— Роуты ———
async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const path = url.pathname

  if (path === '/api/health' || path === '/health') {
    const checks = {}
    try { await pool.query('SELECT 1'); checks.postgres = 'up' } catch { checks.postgres = 'down' }
    try { if (redis.status !== 'ready') await redis.connect(); await redis.ping(); checks.redis = 'up' } catch { checks.redis = 'down' }
    return json(res, checks.postgres === 'up' ? 200 : 503, { service: 'ithona-taskboard-api', status: checks.postgres === 'up' ? 'ok' : 'degraded', checks })
  }

  if (path === '/api/auth/me' && req.method === 'GET') {
    const u = await currentUser(req)
    return json(res, 200, {
      authRequired: AUTH_REQUIRED,
      accountsEnabled: ACCOUNTS,
      authenticated: AUTH_REQUIRED ? !!u : true,
      user: publicUser(u),
    })
  }

  if (path === '/api/auth/register' && req.method === 'POST') {
    if (!ACCOUNTS) return json(res, 403, { error: 'registration_disabled' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const name = String(b.name ?? '').trim()
    const login = String(b.login ?? '').trim() // регистр сохраняем (напр. «Khudoyor»)
    const password = String(b.password ?? '')
    const department = String(b.department ?? '').trim()
    const birthday = String(b.birthday ?? '').trim()
    const email = String(b.email ?? '').trim()
    const position = String(b.position ?? '').trim()
    if (!safeEqual(String(b.code ?? ''), INVITE_CODE)) return json(res, 403, { error: 'bad_code' })
    if (
      name.length < 2 ||
      login.length < 3 ||
      password.length < 6 ||
      department.length < 1 ||
      position.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthday)
    )
      return json(res, 400, { error: 'invalid_fields' })
    const exists = await pool.query('SELECT 1 FROM users WHERE lower(login) = lower($1)', [login])
    if (exists.rows.length) return json(res, 409, { error: 'login_taken' })
    const count = await pool.query('SELECT count(*)::int AS n FROM users')
    const role = count.rows[0].n === 0 ? 'admin' : 'member'
    const { salt, hash } = hashPassword(password)
    const id = 'u_' + crypto.randomBytes(6).toString('hex')
    const initials = initialsFrom(name)
    const color = colorFor(login)
    await pool.query(
      `INSERT INTO users (id, login, name, initials, color, role, pass_salt, pass_hash, department, birthday, email, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, login, name, initials, color, role, salt, hash, department, birthday, email, position],
    )
    const cookie = await newSession(id)
    return json(
      res,
      200,
      { ok: true, user: publicUser({ id, login, name, initials, color, role, department, birthday, email, position }) },
      { 'Set-Cookie': cookie },
    )
  }

  // Список команды (для раздела «Компания» и дней рождения)
  if (path === '/api/users' && req.method === 'GET') {
    if (AUTH_REQUIRED && !(await currentUser(req))) return json(res, 401, { error: 'unauthorized' })
    const { rows } = await pool.query(
      'SELECT id, login, name, initials, color, role, department, birthday, email, position FROM users ORDER BY name',
    )
    return json(res, 200, { users: rows.map(publicUser) })
  }

  // Сброс пароля сотрудника (только админ)
  if (path === '/api/users/reset-password' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || me.role !== 'admin') return json(res, 403, { error: 'forbidden' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const userId = String(b.userId ?? '')
    const password = String(b.password ?? '')
    if (password.length < 6) return json(res, 400, { error: 'invalid_fields' })
    const target = await pool.query('SELECT id FROM users WHERE id = $1', [userId])
    if (!target.rows.length) return json(res, 404, { error: 'not_found' })
    const { salt, hash } = hashPassword(password)
    await pool.query('UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3', [salt, hash, userId])
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]).catch(() => {})
    return json(res, 200, { ok: true })
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    if (!AUTH_REQUIRED) return json(res, 200, { ok: true })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const login = String(b.login ?? '').trim()
    const password = String(b.password ?? '')
    if (ACCOUNTS) {
      // Вход без учёта регистра логина: «Khudoyor» == «khudoyor».
      const { rows } = await pool.query('SELECT * FROM users WHERE lower(login) = lower($1)', [login])
      const u = rows[0]
      if (!u || !verifyPassword(password, u.pass_salt, u.pass_hash)) return json(res, 401, { error: 'invalid_credentials' })
      const cookie = await newSession(u.id)
      return json(res, 200, { ok: true, user: publicUser(u) }, { 'Set-Cookie': cookie })
    }
    // Общий вход
    if (!safeEqual(login.toLowerCase(), AUTH_LOGIN.toLowerCase()) || !safeEqual(password, AUTH_PASSWORD)) {
      return json(res, 401, { error: 'invalid_credentials' })
    }
    const cookie = await newSession(null)
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie })
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    const sid = parseCookies(req).sid
    if (sid) await pool.query('DELETE FROM sessions WHERE token = $1', [sid]).catch(() => {})
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' })
  }

  if (path === '/api/board') {
    if (AUTH_REQUIRED && !(await currentUser(req))) return json(res, 401, { error: 'unauthorized' })
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
