/**
 * Домены корпоративной почты, с которых разрешена регистрация.
 *
 * Здесь — только подсказка и предварительная проверка для формы: окончательное
 * решение всегда принимает сервер (`api/emailDomains.js`, переменная окружения
 * ALLOWED_EMAIL_DOMAINS). Проверка на клиенте нужна ради понятного сообщения,
 * защитой она не является.
 */
export const ALLOWED_EMAIL_DOMAINS = ['ithona.tj', 'fazo-tech.tj']

/** Разрешён ли адрес: домен сравнивается точно, поддомены не подходят. */
export function emailDomainAllowed(email: string): boolean {
  const s = email.trim().toLowerCase()
  const at = s.lastIndexOf('@')
  if (at <= 0 || at === s.length - 1) return false
  return ALLOWED_EMAIL_DOMAINS.includes(s.slice(at + 1))
}

/** «@ithona.tj или @fazo-tech.tj» — для подсказок и сообщений об ошибке. */
export function domainsHint(): string {
  return ALLOWED_EMAIL_DOMAINS.map((d) => '@' + d).join(' или ')
}
