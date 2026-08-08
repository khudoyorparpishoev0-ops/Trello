// Ограничение регистрации корпоративными доменами.
//
// Зарегистрироваться и указать в профиле можно только рабочую почту компании.
// Список задаётся переменной окружения ALLOWED_EMAIL_DOMAINS через запятую.
//
// Поведение намеренно защитное: если переменная не задана, пуста или содержит
// мусор — действуют домены по умолчанию. Снять ограничение можно только явно,
// значением «*». Иначе достаточно было бы опечатки в .env, чтобы регистрация
// молча открылась для любой почты.

const DEFAULT_DOMAINS = ['ithona.tj', 'fazo-tech.tj']

/** Разобрать список доменов из строки окружения. */
export function parseDomains(raw) {
  if (raw === undefined || raw === null) return [...DEFAULT_DOMAINS]
  const s = String(raw).trim()
  if (s === '*') return [] // явное снятие ограничения
  const list = s
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
  return list.length ? list : [...DEFAULT_DOMAINS]
}

/** Действующий список доменов (из окружения либо по умолчанию). */
export function allowedDomains(env = process.env) {
  return parseDomains(env.ALLOWED_EMAIL_DOMAINS)
}

/** Домен адреса в нижнем регистре, либо '' если адрес не похож на e-mail. */
export function emailDomain(email) {
  const s = String(email ?? '').trim().toLowerCase()
  const at = s.lastIndexOf('@')
  if (at <= 0 || at === s.length - 1) return ''
  return s.slice(at + 1)
}

/**
 * Разрешён ли адрес. Пустой список доменов означает «ограничения нет».
 * Поддомены (mail.ithona.tj) НЕ считаются разрешёнными: сравнение точное,
 * иначе домен вида «ithona.tj.example.com» прошёл бы проверку.
 */
export function isEmailAllowed(email, domains = allowedDomains()) {
  if (!domains.length) return true
  const d = emailDomain(email)
  if (!d) return false
  return domains.includes(d)
}

/** Текст подсказки для интерфейса и сообщений об ошибке. */
export function domainsHint(domains = allowedDomains()) {
  return domains.map((d) => '@' + d).join(' или ')
}
