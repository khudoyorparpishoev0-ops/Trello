import { randomBytes } from 'node:crypto'
import { uuidv7 } from 'uuidv7'

/** Первичные ключи и id событий — UUID v7, генерируются на сервере (§3). */
export function newId(): string {
  return uuidv7()
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * requestId — ULID (§9.5): 48 бит времени + 80 бит случайности, 26 символов
 * Crockford base32. Сортируется по времени, удобен в логах.
 */
export function newRequestId(now: number = Date.now()): string {
  let time = ''
  let t = now
  for (let i = 0; i < 10; i += 1) {
    time = CROCKFORD.charAt(t % 32) + time
    t = Math.floor(t / 32)
  }
  const bytes = randomBytes(10)
  let bits = 0n
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte)
  let random = ''
  for (let i = 0; i < 16; i += 1) {
    random = CROCKFORD.charAt(Number(bits & 31n)) + random
    bits >>= 5n
  }
  return time + random
}
