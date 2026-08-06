// Ограничение частоты попыток входа (защита от перебора пароля).
// Счётчики в памяти процесса: API работает одним экземпляром, внешнее
// хранилище для этого не требуется.

const WINDOW_MS = 15 * 60 * 1000 // окно наблюдения
const MAX_FAILS = 10 // неудачных попыток за окно
const BLOCK_MS = 15 * 60 * 1000 // блокировка после превышения

/** Счётчики: ключ → { fails, first, blockedUntil }. */
const buckets = new Map()

function prune(now) {
  for (const [k, b] of buckets) {
    if (b.blockedUntil > now) continue
    if (now - b.first > WINDOW_MS) buckets.delete(k)
  }
}

/** Ключ ограничения: IP + логин (перебор и по одному, и по разным логинам). */
export function limiterKey(ip, login) {
  return `${ip || 'unknown'}|${String(login || '').toLowerCase()}`
}

/** Заблокирован ли ключ. Возвращает 0 либо число секунд до разблокировки. */
export function retryAfter(key, now = Date.now()) {
  const b = buckets.get(key)
  if (!b || b.blockedUntil <= now) return 0
  return Math.ceil((b.blockedUntil - now) / 1000)
}

/** Отметить неудачную попытку. Возвращает true, если ключ заблокирован. */
export function registerFailure(key, now = Date.now()) {
  prune(now)
  const b = buckets.get(key) ?? { fails: 0, first: now, blockedUntil: 0 }
  if (now - b.first > WINDOW_MS) {
    b.fails = 0
    b.first = now
  }
  b.fails += 1
  if (b.fails >= MAX_FAILS) {
    b.blockedUntil = now + BLOCK_MS
    b.fails = 0
    b.first = now
  }
  buckets.set(key, b)
  return b.blockedUntil > now
}

/** Сбросить счётчик после успешного входа. */
export function registerSuccess(key) {
  buckets.delete(key)
}

/** Только для тестов: очистить все счётчики. */
export function _reset() {
  buckets.clear()
}

export const LIMITS = { WINDOW_MS, MAX_FAILS, BLOCK_MS }
