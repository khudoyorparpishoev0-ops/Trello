import { z } from 'zod'

/** Все первичные ключи — UUID v7, генерируются на сервере (§3, §5.1). */
export const UuidSchema = z.uuid()

/**
 * Компания-«система» для инфраструктурных событий Phase 1 (`system.ping`).
 *
 * `domain_events.company_id` обязателен (§10.2), а компаний в Phase 1 ещё нет.
 * Nil UUID никогда не совпадёт с UUID v7 реальной компании; у журнала событий
 * нет FK на `companies` (§21.1), поэтому появление таблицы компаний в Phase 3
 * с ним не конфликтует. Бизнес-события всегда пишутся с `ctx.companyId`.
 */
export const SYSTEM_COMPANY_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Формат `x-request-id`, который API принимает от прокси (§23.9): ULID (свой
 * формат запросов, §9.5) или UUID (например, из Caddy). Иначе генерируется новый.
 */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && (ULID.test(value) || UUID.test(value))
}
