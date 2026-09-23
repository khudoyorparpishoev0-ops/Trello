import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index.js'

export type Schema = typeof schema
export type Db = NodePgDatabase<Schema>
/**
 * Транзакция Drizzle. `emit()` и репозитории принимают именно её: у `Db` нет
 * `rollback()`, поэтому передать соединение вне транзакции не скомпилируется (§10.4).
 */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export interface DbOptions {
  connectionString: string
  /** Имя в `pg_stat_activity` — видно, какой процесс держит соединения. */
  applicationName: string
  /** Ошибки простаивающих соединений (рестарт PostgreSQL). Без обработчика pg роняет процесс. */
  onPoolError: (err: Error) => void
  max?: number
  connectionTimeoutMillis?: number
  idleTimeoutMillis?: number
}

export interface DbHandle {
  readonly db: Db
  readonly pool: pg.Pool
  close(): Promise<void>
}

/** Пул соединений + Drizzle. Пул ленивый: соединение открывается первым запросом. */
export function createDb(options: DbOptions): DbHandle {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    application_name: options.applicationName,
    max: options.max ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
  })
  pool.on('error', options.onPoolError)
  const db = drizzle({ client: pool, schema })
  let closed: Promise<void> | undefined
  return {
    db,
    pool,
    close: () => (closed ??= pool.end()),
  }
}
