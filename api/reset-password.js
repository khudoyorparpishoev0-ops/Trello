// Аварийный сброс пароля пользователя напрямую в БД (когда админ потерял доступ).
// Пароль шифруется так же, как в server.js (scrypt + случайная соль).
//
// Запуск ВНУТРИ контейнера api (пароль задаётся переменной, в код не попадает):
//   docker compose exec -e NEWPASS='вашновыйпароль' api node reset-password.js
// Если админов несколько или нужен конкретный пользователь — добавьте логин:
//   docker compose exec -e NEWPASS='...' -e LOGIN='Khudoyor' api node reset-password.js
//
// Без LOGIN сбрасывается пароль первого администратора. Старые сессии этого
// пользователя удаляются, чтобы чужой вход (если был) перестал действовать.

import crypto from 'node:crypto'
import pg from 'pg'

const pw = process.env.NEWPASS ?? ''
const login = (process.env.LOGIN ?? '').trim()

if (pw.length < 6) {
  console.error('❌ Задайте NEWPASS длиной не меньше 6 символов: -e NEWPASS=\'ваш_пароль\'')
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
  console.log(`✅ Пароль обновлён: логин «${u.login}» (${u.name}, роль ${u.role}). Старые сессии сброшены.`)
  console.log('   Войдите с новым паролем и при желании смените его в «Мой профиль».')
} finally {
  await pool.end()
}
