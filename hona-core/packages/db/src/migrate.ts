import { fileURLToPath, pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

/**
 * Применение forward-only миграций (§16, §23.7).
 *
 * Подключение под `hona_migrate`; `pg_advisory_lock` не даёт двум запускам
 * применять миграции одновременно; `lock_timeout = 5s` не даёт DDL бесконечно
 * ждать блокировок приложения. Сами миграции применяет migrator Drizzle
 * в одной транзакции и записывает их в `drizzle.__drizzle_migrations`.
 */

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url))

/** Ключ advisory-блокировки мигратора. Константа, чтобы её было видно в `pg_locks`. */
export const MIGRATION_LOCK_KEY = 7_401_220_001

export interface MigrationResult {
  readonly appliedBefore: number
  readonly appliedAfter: number
}

export interface RunMigrationsOptions {
  connectionString: string
  migrationsFolder?: string
}

async function countApplied(client: pg.Client): Promise<number> {
  const exists = await client.query<{ present: boolean }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  )
  if (!exists.rows[0]?.present) return 0
  const result = await client.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
  )
  return result.rows[0]?.n ?? 0
}

export async function runMigrations(options: RunMigrationsOptions): Promise<MigrationResult> {
  const client = new pg.Client({
    connectionString: options.connectionString,
    application_name: 'hona-migrate',
  })
  await client.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])
    try {
      await client.query("SET lock_timeout = '5s'")
      const appliedBefore = await countApplied(client)
      await migrate(drizzle({ client }), {
        migrationsFolder: options.migrationsFolder ?? MIGRATIONS_FOLDER,
      })
      const appliedAfter = await countApplied(client)
      return { appliedBefore, appliedAfter }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
    }
  } finally {
    await client.end()
  }
}

function log(level: 'info' | 'error', msg: string, extra: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra })
  if (level === 'error') process.stderr.write(`${line}\n`)
  else process.stdout.write(`${line}\n`)
}

async function main(): Promise<void> {
  const { readMigrateEnv } = await import('./config/env.js')
  const env = readMigrateEnv()
  log('info', 'migrations: start')
  const result = await runMigrations({ connectionString: env.DATABASE_URL_MIGRATE })
  log('info', 'migrations: done', {
    appliedBefore: result.appliedBefore,
    appliedNow: result.appliedAfter - result.appliedBefore,
    total: result.appliedAfter,
  })
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((err: unknown) => {
    // Сообщение pg не содержит строку подключения; сам URL не печатается никогда.
    log('error', 'migrations: failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exitCode = 1
  })
}
