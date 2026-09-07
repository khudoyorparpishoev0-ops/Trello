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
import { initTelegram, getBotUsername, telegramEnabled, notifyAssignments, notifyDueChanges } from './telegram.js'
import { validateBoardPayload, shouldSnapshot, parseVersion, versionConflict } from './boardGuard.js'
import { limiterKey, retryAfter, registerFailure, registerSuccess } from './rateLimit.js'
import { allowedDomains, isEmailAllowed, domainsHint } from './emailDomains.js'
import { mailerEnabled, sendVerificationCode, verifyMailer } from './mailer.js'
import {
  CODE_TTL_MS,
  canResend,
  checkStoredCode,
  generateCode,
  hashCode,
  resendWaitSeconds,
} from './verifyCodes.js'

const PORT = Number(process.env.PORT ?? 3000)
const INVITE_CODE = process.env.INVITE_CODE ?? ''
// Личные аккаунты включены, если настроена почта (код подтверждения приходит
// письмом) либо задан код-приглашение (прежний способ, пока почты нет).
const EMAIL_VERIFY = mailerEnabled()
const ACCOUNTS = EMAIL_VERIFY || INVITE_CODE.length > 0
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
  // Номер версии доски: растёт на каждой записи, по нему ловится конфликт
  // одновременного редактирования (см. GET/PUT /api/board).
  await pool.query(`ALTER TABLE board_state ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1`)
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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_chat_id text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_code text`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text`)
  // Журнал отправленных уведомлений — защита от повторов (день рождения/дедлайн).
  await pool.query(`CREATE TABLE IF NOT EXISTS notif_log (
    key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`)
  // Коды подтверждения регистрации: хранится только хеш кода.
  await pool.query(`CREATE TABLE IF NOT EXISTS email_codes (
    email text PRIMARY KEY,
    code_hash text NOT NULL,
    attempts int NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now())`)
  // Снимки доски перед перезаписью — страховка от потери данных.
  await pool.query(`CREATE TABLE IF NOT EXISTS board_history (
    id bigserial PRIMARY KEY,
    board_id text NOT NULL,
    data jsonb NOT NULL,
    cards int,
    actor text,
    created_at timestamptz NOT NULL DEFAULT now())`)
  await pool.query(`CREATE INDEX IF NOT EXISTS board_history_created_idx ON board_history (board_id, created_at DESC)`)
}

async function initWithRetry() {
  for (let i = 0; i < 30; i++) {
    try {
      await ensureSchema()
      const mode = ACCOUNTS ? 'личные аккаунты' : SHARED ? 'общий вход' : 'открытый'
      console.log(`[api] схема БД готова · режим: ${mode}`)
      initTelegram(pool).catch((e) => console.error('[tg] init:', e.message))
      verifyMailer().catch((e) => console.error('[mail] проверка:', e.message))
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

/** IP клиента с учётом обратного прокси (Caddy передаёт X-Forwarded-For). */
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

// Куки помечаем Secure, когда сайт открыт по HTTPS: без флага браузер отдаёт
// сессию и по обычному HTTP. SITE_ADDRESS без схемы «:80» означает работу по IP.
const SITE_ADDRESS = process.env.SITE_ADDRESS ?? ''
const HTTPS_SITE = SITE_ADDRESS.length > 0 && !SITE_ADDRESS.startsWith(':') && !SITE_ADDRESS.startsWith('http://')

function sessionCookie(token, maxAge = SESSION_DAYS * 24 * 3600) {
  return `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${HTTPS_SITE ? '; Secure' : ''}`
}

// ——— Сессии / текущий пользователь ———
async function newSession(userId) {
  const token = crypto.randomBytes(24).toString('hex')
  await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId])
  return sessionCookie(token)
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
      'SELECT id, login, name, initials, color, role, department, birthday, email, position, avatar FROM users WHERE id = $1',
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
    avatar: u.avatar ?? '',
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
      // true — код подтверждения приходит на рабочую почту (поле «код
      // приглашения» в форме не нужно); false — прежний код от администратора.
      emailVerification: EMAIL_VERIFY,
      emailDomains: allowedDomains(),
      authenticated: AUTH_REQUIRED ? !!u : true,
      user: publicUser(u),
    })
  }

  // Запрос кода подтверждения на рабочую почту.
  if (path === '/api/auth/register/request-code' && req.method === 'POST') {
    if (!ACCOUNTS) return json(res, 403, { error: 'registration_disabled' })
    if (!EMAIL_VERIFY) return json(res, 400, { error: 'email_verification_disabled' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const email = String(b.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'invalid_email' })
    if (!isEmailAllowed(email)) {
      return json(res, 403, { error: 'email_domain_not_allowed', domains: allowedDomains(), hint: domainsHint() })
    }
    // Адрес уже занят — код не отправляем, чтобы письмо не служило подсказкой.
    const taken = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email])
    if (taken.rows.length) return json(res, 409, { error: 'email_taken' })

    // Ограничение частоты: и по адресу, и по IP.
    const ipKey = limiterKey(clientIp(req), 'register-code')
    const ipWait = retryAfter(ipKey)
    if (ipWait > 0) return json(res, 429, { error: 'too_many_attempts', retryAfter: ipWait })

    const prev = await pool.query('SELECT created_at FROM email_codes WHERE email = $1', [email])
    const wait = resendWaitSeconds(prev.rows[0])
    if (!canResend(prev.rows[0])) return json(res, 429, { error: 'code_resend_wait', retryAfter: wait })

    const code = generateCode()
    const expires = new Date(Date.now() + CODE_TTL_MS).toISOString()
    await pool.query(
      `INSERT INTO email_codes (email, code_hash, attempts, expires_at, created_at)
       VALUES ($1, $2, 0, $3, now())
       ON CONFLICT (email) DO UPDATE SET code_hash = $2, attempts = 0, expires_at = $3, created_at = now()`,
      [email, hashCode(email, code), expires],
    )
    try {
      await sendVerificationCode(email, code, CODE_TTL_MS)
    } catch (e) {
      console.error('[mail] отправка не удалась:', e.message)
      await pool.query('DELETE FROM email_codes WHERE email = $1', [email]).catch(() => {})
      return json(res, 502, { error: 'mail_send_failed' })
    }
    registerFailure(ipKey) // считаем запросы кода, чтобы нельзя было рассылать письма пачками
    return json(res, 200, { ok: true, ttlMinutes: Math.round(CODE_TTL_MS / 60000) })
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
    // Подтверждение: код из письма (если почта настроена) либо код-приглашение.
    if (EMAIL_VERIFY) {
      const mail = email.toLowerCase()
      const row = (await pool.query('SELECT * FROM email_codes WHERE email = $1', [mail])).rows[0]
      const verdict = checkStoredCode(row, mail, String(b.code ?? ''))
      if (!verdict.ok) {
        // Неудачную попытку засчитываем, чтобы код нельзя было подобрать.
        if (row && verdict.error === 'invalid_code') {
          await pool.query('UPDATE email_codes SET attempts = attempts + 1 WHERE email = $1', [mail]).catch(() => {})
        }
        return json(res, 403, { error: verdict.error })
      }
    } else if (!safeEqual(String(b.code ?? ''), INVITE_CODE)) {
      return json(res, 403, { error: 'bad_code' })
    }
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
    // Регистрация только с корпоративной почты компании.
    if (!isEmailAllowed(email)) {
      return json(res, 403, { error: 'email_domain_not_allowed', domains: allowedDomains(), hint: domainsHint() })
    }
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
    // Код одноразовый: повторно использовать его нельзя.
    if (EMAIL_VERIFY) {
      await pool.query('DELETE FROM email_codes WHERE email = $1', [email.toLowerCase()]).catch(() => {})
    }
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
      'SELECT id, login, name, initials, color, role, department, birthday, email, position, avatar FROM users ORDER BY name',
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

  // Сменить свой пароль (нужен текущий пароль)
  if (path === '/api/auth/change-password' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 401, { error: 'unauthorized' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const currentPassword = String(b.currentPassword ?? '')
    const newPassword = String(b.newPassword ?? '')
    if (newPassword.length < 6) return json(res, 400, { error: 'invalid_fields' })
    const { rows } = await pool.query('SELECT pass_salt, pass_hash FROM users WHERE id = $1', [me.id])
    const u = rows[0]
    if (!u || !verifyPassword(currentPassword, u.pass_salt, u.pass_hash))
      return json(res, 403, { error: 'wrong_password' })
    const { salt, hash } = hashPassword(newPassword)
    await pool.query('UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3', [salt, hash, me.id])
    return json(res, 200, { ok: true })
  }

  // Обновить свой профиль (имя, e-mail, должность, отдел, дата рождения)
  if (path === '/api/auth/profile' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 401, { error: 'unauthorized' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const name = String(b.name ?? '').trim()
    const email = String(b.email ?? '').trim()
    const department = String(b.department ?? '').trim()
    const position = String(b.position ?? '').trim()
    const birthday = String(b.birthday ?? '').trim()
    if (
      name.length < 2 ||
      position.length < 2 ||
      department.length < 1 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthday)
    )
      return json(res, 400, { error: 'invalid_fields' })
    // Ограничение по домену действует и здесь: иначе его можно было бы обойти,
    // сменив почту в профиле сразу после регистрации.
    if (!isEmailAllowed(email)) {
      return json(res, 403, { error: 'email_domain_not_allowed', domains: allowedDomains(), hint: domainsHint() })
    }
    const initials = initialsFrom(name)
    await pool.query(
      'UPDATE users SET name = $1, email = $2, department = $3, position = $4, birthday = $5, initials = $6 WHERE id = $7',
      [name, email, department, position, birthday, initials, me.id],
    )
    const u = await pool.query(
      'SELECT id, login, name, initials, color, role, department, birthday, email, position, avatar FROM users WHERE id = $1',
      [me.id],
    )
    return json(res, 200, { ok: true, user: publicUser(u.rows[0]) })
  }

  // Загрузить/удалить фото профиля (data-URL картинки, до ~700 КБ)
  if (path === '/api/auth/avatar' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 401, { error: 'unauthorized' })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const raw = b.avatar
    let avatar = null
    if (raw != null && String(raw).length > 0) {
      const s = String(raw)
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(s)) return json(res, 400, { error: 'invalid_image' })
      if (s.length > 700_000) return json(res, 413, { error: 'image_too_large' })
      avatar = s
    }
    await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, me.id])
    return json(res, 200, { ok: true, avatar: avatar ?? '' })
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    if (!AUTH_REQUIRED) return json(res, 200, { ok: true })
    const body = await readBody(req)
    let b = {}
    try { b = JSON.parse(body) } catch { return json(res, 400, { error: 'bad_request' }) }
    const login = String(b.login ?? '').trim()
    const password = String(b.password ?? '')

    // Защита от перебора пароля: после серии неудач вход временно закрыт.
    const key = limiterKey(clientIp(req), login)
    const wait = retryAfter(key)
    if (wait > 0) {
      return json(res, 429, { error: 'too_many_attempts', retryAfter: wait }, { 'Retry-After': String(wait) })
    }

    if (ACCOUNTS) {
      // Вход без учёта регистра логина: «Khudoyor» == «khudoyor».
      const { rows } = await pool.query('SELECT * FROM users WHERE lower(login) = lower($1)', [login])
      const u = rows[0]
      if (!u || !verifyPassword(password, u.pass_salt, u.pass_hash)) {
        registerFailure(key)
        return json(res, 401, { error: 'invalid_credentials' })
      }
      registerSuccess(key)
      const cookie = await newSession(u.id)
      return json(res, 200, { ok: true, user: publicUser(u) }, { 'Set-Cookie': cookie })
    }
    // Общий вход
    if (!safeEqual(login.toLowerCase(), AUTH_LOGIN.toLowerCase()) || !safeEqual(password, AUTH_PASSWORD)) {
      registerFailure(key)
      return json(res, 401, { error: 'invalid_credentials' })
    }
    registerSuccess(key)
    const cookie = await newSession(null)
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie })
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    const sid = parseCookies(req).sid
    if (sid) await pool.query('DELETE FROM sessions WHERE token = $1', [sid]).catch(() => {})
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) })
  }

  // ——— Telegram ———
  // Статус подключения текущего пользователя.
  if (path === '/api/telegram/status' && req.method === 'GET') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 200, { enabled: telegramEnabled(), linked: false, botUsername: getBotUsername() })
    const { rows } = await pool.query('SELECT tg_chat_id FROM users WHERE id = $1', [me.id])
    return json(res, 200, {
      enabled: telegramEnabled(),
      linked: !!rows[0]?.tg_chat_id,
      botUsername: getBotUsername(),
    })
  }

  // Сгенерировать код и ссылку для привязки.
  if (path === '/api/telegram/link' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 401, { error: 'unauthorized' })
    if (!telegramEnabled()) return json(res, 400, { error: 'telegram_disabled' })
    const code = crypto.randomBytes(5).toString('hex')
    await pool.query('UPDATE users SET tg_code = $1 WHERE id = $2', [code, me.id])
    const botUsername = getBotUsername()
    const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : ''
    return json(res, 200, { code, botUsername, deepLink })
  }

  // Отвязать Telegram.
  if (path === '/api/telegram/unlink' && req.method === 'POST') {
    const me = await currentUser(req)
    if (!me || !me.id) return json(res, 401, { error: 'unauthorized' })
    await pool.query('UPDATE users SET tg_chat_id = NULL, tg_code = NULL WHERE id = $1', [me.id])
    return json(res, 200, { ok: true })
  }

  if (path === '/api/board') {
    const actor = await currentUser(req)
    if (AUTH_REQUIRED && !actor) return json(res, 401, { error: 'unauthorized' })
    if (req.method === 'GET') {
      const { rows } = await pool.query("SELECT data, version FROM board_state WHERE id = 'default'")
      // Версия уходит заголовком, а не в теле: тело — само состояние доски,
      // и оборачивать его в конверт значило бы сломать уже работающие клиенты.
      const headers = rows[0] ? { 'X-Board-Version': String(rows[0].version) } : undefined
      return json(res, 200, rows[0] ? rows[0].data : null, headers)
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req)
      let newData
      try {
        newData = JSON.parse(body)
      } catch {
        return json(res, 400, { error: 'bad_request', detail: 'тело запроса не является JSON' })
      }
      // Структурная проверка: неверный блоб затирал доску всей компании.
      const check = validateBoardPayload(newData)
      if (!check.ok) return json(res, 422, { error: check.error, detail: check.detail })

      // Прежнее состояние — для уведомлений, снимка истории и сверки версии.
      const prev = await pool.query("SELECT data, version FROM board_state WHERE id = 'default'")
      const prevData = prev.rows[0]?.data
      const prevVersion = prev.rows[0]?.version ?? null
      const clientVersion = parseVersion(req.headers['x-board-version'])

      // Конфликт одновременного редактирования: доску уже изменил кто-то другой.
      // Ничего не пишем — иначе правки первого исчезнут молча.
      if (versionConflict(clientVersion, prevVersion)) {
        return json(res, 409, { error: 'version_conflict', version: Number(prevVersion) })
      }

      // Снимок предыдущего состояния (разреженно; при заметной потере карточек — всегда).
      try {
        const last = await pool.query(
          "SELECT created_at FROM board_history WHERE board_id = 'default' ORDER BY created_at DESC LIMIT 1",
        )
        if (shouldSnapshot(prevData, newData, last.rows[0]?.created_at)) {
          await pool.query(
            `INSERT INTO board_history (board_id, data, cards, actor) VALUES ('default', $1::jsonb, $2, $3)`,
            [JSON.stringify(prevData), Object.keys(prevData?.cards ?? {}).length, actor?.name ?? null],
          )
          // Держим последние 50 снимков.
          await pool.query(
            `DELETE FROM board_history WHERE board_id = 'default' AND id NOT IN (
               SELECT id FROM board_history WHERE board_id = 'default' ORDER BY created_at DESC LIMIT 50)`,
          )
        }
      } catch (e) {
        console.error('[api] снимок истории не сохранён:', e.message)
      }

      let nextVersion
      if (prevVersion === null) {
        // Первая запись (или строка от прежней схемы) — сверять не с чем.
        const ins = await pool.query(
          `INSERT INTO board_state (id, data, version) VALUES ('default', $1::jsonb, 1)
           ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, version = board_state.version + 1,
             updated_at = now()
           RETURNING version`,
          [body],
        )
        nextVersion = Number(ins.rows[0].version)
      } else {
        // Условие по версии в самом UPDATE: между SELECT выше и записью мог
        // успеть вклиниться другой запрос, и проверка в приложении его не
        // поймала бы. Ноль обновлённых строк — тот же конфликт.
        const upd = await pool.query(
          `UPDATE board_state SET data = $1::jsonb, version = version + 1, updated_at = now()
           WHERE id = 'default' AND version = $2 RETURNING version`,
          [body, prevVersion],
        )
        if (!upd.rowCount) {
          const cur = await pool.query("SELECT version FROM board_state WHERE id = 'default'")
          return json(res, 409, { error: 'version_conflict', version: Number(cur.rows[0]?.version ?? 0) })
        }
        nextVersion = Number(upd.rows[0].version)
      }
      // Уведомления (назначение + смена срока) — в фоне, ответ не задерживаем.
      notifyAssignments(pool, prevData, newData, actor?.id, actor?.name).catch((e) =>
        console.error('[tg] assign:', e.message),
      )
      notifyDueChanges(pool, prevData, newData, actor?.id, actor?.name).catch((e) =>
        console.error('[tg] due:', e.message),
      )
      return json(res, 200, { ok: true, version: nextVersion }, { 'X-Board-Version': String(nextVersion) })
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
