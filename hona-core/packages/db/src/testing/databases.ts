import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { runMigrations } from '../migrate.js'
import { readTestDbEnv, vitestPoolId, type TestDbEnv } from './env.js'

/**
 * Управление тестовыми базами. Работает ТОЛЬКО с базами `hona_test_*`:
 * любое другое имя — исключение до обращения к PostgreSQL.
 */
export const TEST_DB_PREFIX = 'hona_test_'
export const TEMPLATE_DB = `${TEST_DB_PREFIX}template`
const SAFE_NAME = /^hona_test_[a-z0-9_]{1,40}$/

export function assertTestDatabaseName(name: string): string {
  if (!SAFE_NAME.test(name)) throw new Error(`Refusing to touch non-test database "${name}"`)
  return name
}

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

/**
 * DDL с именами баз: идентификатор нельзя передать параметром, поэтому он
 * экранируется pg.escapeIdentifier (а до этого проверен assertTestDatabaseName).
 */
function ddl(strings: TemplateStringsArray, ...identifiers: string[]): string {
  return strings.reduce(
    (text, part, i) =>
      text + part + (i < identifiers.length ? pg.escapeIdentifier(identifiers[i] as string) : ''),
    '',
  )
}

async function withAdmin<T>(env: TestDbEnv, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString: env.adminUrl,
    application_name: 'hona-test-admin',
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/** Права уровня базы не копируются из шаблона — повторяем то, что делает init/01-roles.sh. */
async function applyDatabaseAcl(client: pg.Client, name: string): Promise<void> {
  await client.query(ddl`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`)
  await client.query(ddl`GRANT CONNECT ON DATABASE ${name} TO hona_app, hona_readonly`)
}

export async function dropTestDatabase(name: string, env = readTestDbEnv()): Promise<void> {
  assertTestDatabaseName(name)
  await withAdmin(env, (client) => client.query(ddl`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`))
}

export async function listTestDatabases(env = readTestDbEnv()): Promise<string[]> {
  return withAdmin(env, async (client) => {
    const res = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE 'hona\\_test\\_%' ORDER BY datname",
    )
    return res.rows.map((row) => row.datname)
  })
}

/** Пустая база без миграций — для тестов «миграции с нуля». */
export async function createEmptyTestDatabase(
  label: string,
  env = readTestDbEnv(),
): Promise<string> {
  const name = assertTestDatabaseName(
    `${TEST_DB_PREFIX}${label}_${vitestPoolId()}_${randomBytes(3).toString('hex')}`,
  )
  await withAdmin(env, async (client) => {
    await client.query(ddl`CREATE DATABASE ${name} OWNER hona_migrate`)
    await applyDatabaseAcl(client, name)
  })
  return name
}

/** Шаблон: пустая база + все миграции. Вызывается один раз из globalSetup. */
export async function createTemplateDatabase(env = readTestDbEnv()): Promise<void> {
  await dropTestDatabase(TEMPLATE_DB, env)
  await withAdmin(env, async (client) => {
    await client.query(ddl`CREATE DATABASE ${TEMPLATE_DB} OWNER hona_migrate`)
    await applyDatabaseAcl(client, TEMPLATE_DB)
  })
  await runMigrations({ connectionString: withDatabase(env.migrateUrl, TEMPLATE_DB) })
}

/** База текущего воркера Vitest: копия шаблона через CREATE DATABASE … TEMPLATE. */
export async function ensureWorkerDatabase(env = readTestDbEnv()): Promise<string> {
  const name = assertTestDatabaseName(`${TEST_DB_PREFIX}w${vitestPoolId()}`)
  await withAdmin(env, async (client) => {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (exists.rowCount === 0) {
      await client.query(ddl`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DB} OWNER hona_migrate`)
      await applyDatabaseAcl(client, name)
    }
  })
  return name
}
