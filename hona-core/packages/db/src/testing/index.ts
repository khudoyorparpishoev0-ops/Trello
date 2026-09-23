import pg from 'pg'
import { createDb, type DbHandle } from '../client.js'
import {
  assertTestDatabaseName,
  createEmptyTestDatabase,
  dropTestDatabase,
  ensureWorkerDatabase,
  withDatabase,
} from './databases.js'
import { readTestDbEnv } from './env.js'

export {
  assertTestDatabaseName,
  createEmptyTestDatabase,
  dropTestDatabase,
  TEMPLATE_DB,
  TEST_DB_PREFIX,
  withDatabase,
} from './databases.js'
export { readTestDbEnv, type TestDbEnv } from './env.js'

/** Строки подключения к базе воркера под каждой из ролей. */
export interface TestDatabase {
  readonly name: string
  readonly appUrl: string
  readonly migrateUrl: string
  readonly readonlyUrl: string
}

export async function workerDatabase(): Promise<TestDatabase> {
  const env = readTestDbEnv()
  const name = await ensureWorkerDatabase(env)
  return describeDatabase(name)
}

export function describeDatabase(name: string): TestDatabase {
  const env = readTestDbEnv()
  assertTestDatabaseName(name)
  const readonly = new URL(withDatabase(env.appUrl, name))
  readonly.username = 'hona_readonly'
  readonly.password = env.readonlyPassword
  return {
    name,
    appUrl: withDatabase(env.appUrl, name),
    migrateUrl: withDatabase(env.migrateUrl, name),
    readonlyUrl: readonly.toString(),
  }
}

/** Пул приложения (hona_app) к тестовой базе. */
export function appDb(database: TestDatabase, applicationName = 'hona-test-app'): DbHandle {
  return createDb({
    connectionString: database.appUrl,
    applicationName,
    onPoolError: () => {
      /* тестовые пулы закрываются явно; ошибки простоя здесь не значимы */
    },
  })
}

/** Очистка между тестами одним TRUNCATE (§15.3). Выполняется владельцем таблиц. */
export async function truncateAll(database: TestDatabase): Promise<void> {
  const client = new pg.Client({ connectionString: database.migrateUrl })
  await client.connect()
  try {
    await client.query('TRUNCATE outbox, outbox_dead_letter, domain_events')
  } finally {
    await client.end()
  }
}

export async function withClient<T>(
  url: string,
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export { createEmptyTestDatabase as createEmptyDatabase, dropTestDatabase as dropDatabase }
