import { z } from 'zod'

/**
 * Окружение CLI мигратора. Единственное место чтения `process.env` в пакете db
 * вне тестовой инфраструктуры. В ошибке — только имена переменных, без значений.
 */
const MigrateEnv = z.object({
  DATABASE_URL_MIGRATE: z.url({ protocol: /^postgres(ql)?$/ }),
})

export type MigrateEnv = z.infer<typeof MigrateEnv>

export function readMigrateEnv(source: NodeJS.ProcessEnv = process.env): MigrateEnv {
  const parsed = MigrateEnv.safeParse(source)
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => String(issue.path[0] ?? '?'))
    throw new Error(`Invalid environment for migrations: ${[...new Set(names)].join(', ')}`)
  }
  return parsed.data
}
