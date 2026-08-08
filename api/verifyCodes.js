// Коды подтверждения регистрации, отправляемые на рабочую почту.
//
// Код хранится только в виде хеша: даже при доступе к базе его нельзя прочитать
// и использовать. У кода ограничен срок жизни и число попыток ввода — иначе
// шестизначное значение подбиралось бы за считанные минуты.

import crypto from 'node:crypto'

export const CODE_TTL_MS = 15 * 60 * 1000 // срок жизни кода
export const MAX_ATTEMPTS = 5 // попыток ввода на один код
export const RESEND_COOLDOWN_MS = 60 * 1000 // пауза между отправками

/** Шестизначный код. Берётся из криптографического источника случайности. */
export function generateCode() {
  return String(crypto.randomInt(100000, 1000000))
}

/** Хеш кода, привязанный к адресу: один и тот же код для разных адресов даёт разные хеши. */
export function hashCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${String(email).trim().toLowerCase()}:${String(code).trim()}`)
    .digest('hex')
}

/** Сравнение хешей за постоянное время. */
export function codeMatches(email, code, storedHash) {
  const a = Buffer.from(hashCode(email, code))
  const b = Buffer.from(String(storedHash ?? ''))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Проверка сохранённой записи кода.
 * Возвращает { ok } либо { ok: false, error } с причиной:
 * not_requested — кода нет, code_expired — истёк, too_many_attempts — исчерпаны
 * попытки, invalid_code — не совпал.
 */
export function checkStoredCode(row, email, code, now = Date.now()) {
  if (!row) return { ok: false, error: 'code_not_requested' }
  if (new Date(row.expires_at).getTime() <= now) return { ok: false, error: 'code_expired' }
  if (Number(row.attempts) >= MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' }
  if (!codeMatches(email, code, row.code_hash)) return { ok: false, error: 'invalid_code' }
  return { ok: true }
}

/** Можно ли отправить новый код (пауза между письмами). */
export function canResend(row, now = Date.now()) {
  if (!row?.created_at) return true
  return now - new Date(row.created_at).getTime() >= RESEND_COOLDOWN_MS
}

/** Сколько секунд осталось ждать до повторной отправки. */
export function resendWaitSeconds(row, now = Date.now()) {
  if (canResend(row, now)) return 0
  return Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(row.created_at).getTime())) / 1000)
}
