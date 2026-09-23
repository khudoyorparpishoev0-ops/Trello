/**
 * Политика повторов (§10.5):
 *   задержка = min(5 с × 2^(attempts−1), 1 ч) × (1 ± 20 %);
 *   на 12-й неудачной попытке строка уходит в outbox_dead_letter.
 * Сумма задержек до dead-letter — около 3,5 ч с учётом разброса: короткий сбой
 * внешнего канала до dead-letter не доходит.
 */
export const MAX_ATTEMPTS = 12
export const BASE_DELAY_MS = 5_000
export const MAX_DELAY_MS = 60 * 60 * 1_000
export const JITTER_RATIO = 0.2

export function backoffDelayMs(attempts: number, random: () => number = Math.random): number {
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be >= 1')
  const base = Math.min(BASE_DELAY_MS * 2 ** (attempts - 1), MAX_DELAY_MS)
  const jitter = 1 + (random() * 2 - 1) * JITTER_RATIO
  return Math.round(base * jitter)
}

export function isExhausted(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS
}
