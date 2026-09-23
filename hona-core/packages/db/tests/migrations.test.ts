import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER, runMigrations } from '../src/migrate.js'
import {
  createEmptyDatabase,
  describeDatabase,
  dropDatabase,
  withClient,
} from '../src/testing/index.js'
import { catalogSnapshot } from './helpers.js'

/** Миграции с нуля, повторный запуск, параллельный запуск (§15.2 Database, §23.8). */
const created: string[] = []

afterAll(async () => {
  for (const name of created) await dropDatabase(name)
})

async function freshDatabase(label: string) {
  const name = await createEmptyDatabase(label)
  created.push(name)
  return describeDatabase(name)
}

describe('migrations from an empty PostgreSQL', () => {
  it('applies 0000_foundation and creates the foundation objects', async () => {
    const db = await freshDatabase('mig_zero')
    const result = await runMigrations({ connectionString: db.migrateUrl })
    expect(result).toEqual({ appliedBefore: 0, appliedAfter: 1 })

    await withClient(db.migrateUrl, async (client) => {
      const tables = await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
      )
      expect(tables.rows.map((row) => row.tablename)).toEqual([
        'domain_events',
        'outbox',
        'outbox_dead_letter',
      ])
      const ext = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'citext'")
      expect(ext.rowCount).toBe(1)
      const fn = await client.query(
        "SELECT prorettype::regtype::text AS returns FROM pg_proc WHERE proname = 'set_updated_at'",
      )
      expect(fn.rows).toEqual([{ returns: 'trigger' }])
      const journal = await client.query('SELECT hash FROM drizzle.__drizzle_migrations')
      expect(journal.rowCount).toBe(1)
    })
  })

  it('a second run changes nothing', async () => {
    const db = await freshDatabase('mig_rerun')
    await runMigrations({ connectionString: db.migrateUrl })
    const before = await withClient(db.migrateUrl, catalogSnapshot)
    const again = await runMigrations({ connectionString: db.migrateUrl })
    expect(again).toEqual({ appliedBefore: 1, appliedAfter: 1 })
    const after = await withClient(db.migrateUrl, catalogSnapshot)
    expect(after).toBe(before)
  })

  it('two parallel runs are serialised by the advisory lock and apply once', async () => {
    const db = await freshDatabase('mig_parallel')
    const results = await Promise.all([
      runMigrations({ connectionString: db.migrateUrl }),
      runMigrations({ connectionString: db.migrateUrl }),
    ])
    expect(results.map((r) => r.appliedAfter)).toEqual([1, 1])
    expect(results.map((r) => r.appliedBefore).sort()).toEqual([0, 1])
  })

  it('refuses to run as the application role (no DDL rights)', async () => {
    const db = await freshDatabase('mig_app_role')
    await expect(runMigrations({ connectionString: db.appUrl })).rejects.toThrow()
  })
})

describe('migration files', () => {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
  ) as {
    entries: { idx: number; tag: string }[]
  }
  const sqlFiles = readdirSync(MIGRATIONS_FOLDER)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  it('journal and SQL files match one-to-one, starting with 0000_foundation', () => {
    expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(sqlFiles)
    expect(journal.entries[0]?.tag).toBe('0000_foundation')
    journal.entries.forEach((entry, i) => expect(entry.idx).toBe(i))
  })

  it('are forward-only: no down migrations', () => {
    expect(readdirSync(MIGRATIONS_FOLDER).filter((file) => /down/i.test(file))).toEqual([])
  })
})
