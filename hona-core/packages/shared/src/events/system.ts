import { z } from 'zod'

/**
 * `system.ping` — инфраструктурное событие Phase 1. Не бизнес-функция: оно
 * существует только чтобы доказать путь emit → domain_events → outbox → воркер.
 */
export const SystemPingPayload = z
  .object({
    note: z.string().min(1).max(200),
  })
  .strict()

export type SystemPingPayload = z.infer<typeof SystemPingPayload>
