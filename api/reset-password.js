// Аварийный сброс пароля пользователя напрямую в БД (когда админ потерял доступ).
// Пароль шифруется так же, как в server.js (scrypt + случайная соль).
//
// Проще всего — БЕЗ своего пароля: скрипт сам придумает надёжный и напечатает его
// (без спецсимволов, чтобы ничего не путалось при вводе):
//   docker compose exec api node reset-password.js
// Если хотите задать свой пароль — через переменную NEWPASS:
//   docker compose exec -e NEWPASS='вашпароль' api node reset-password.js
// Если админов несколько или нужен конкретный пользователь — добавьте логин:
//   docker compose exec -e LOGIN='Khudoyor' api node reset-password.js
//
// Без LOGIN сбрасывается пароль первого администратора. Старые сессии этого
// пользователя удаляются, чтобы прежний вход перестал действовать.

import crypto from 'node:crypto'
import pg from 'pg'

// Пароль без похожих друг на друга символов (нет 0/O, 1/l/I) — легче ввести без ошибок.
function genPassword(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

let pw = process.env.NEWPASS ?? ''
const generated = pw.length === 0
if (generated) pw = genPassword(12)
const login = (process.env.LOGIN ?? '').trim()

if (pw.length < 6) {
  console.error('❌ NEWPASS слишком короткий — минимум 6 символов. Либо запустите без NEWPASS, чтобы пароль сгенерировался автоматически.')
  process.exit(1)
}

const salt = crypto.randomBytes(16).toString('hex')
const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

try {
  const sel = login
    ? await pool.query('SELECT id, login, name, role FROM users WHERE lower(login) = lower($1)', [login])
    : await pool.query("SELECT id, login, name, role FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1")

  if (!sel.rows.length) {
    console.error(login ? `❌ Пользователь с логином «${login}» не найден.` : '❌ Администратор не найден. Укажите -e LOGIN=ваш_логин')
    await pool.end()
    process.exit(1)
  }

  const u = sel.rows[0]
  await pool.query('UPDATE users SET pass_salt = $1, pass_hash = $2 WHERE id = $3', [salt, hash, u.id])
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [u.id]).catch(() => {})
  console.log('──────────────────────────────────────────')
  console.log(`✅ Пароль сброшен. Логин: ${u.login}  (${u.name}, роль ${u.role})`)
  console.log(`🔑 Новый пароль: ${pw}`)
  console.log('──────────────────────────────────────────')
  console.log('   Войдите с этим логином и паролем, затем при желании смените его в «Мой профиль».')
} finally {
  await pool.end()
}
