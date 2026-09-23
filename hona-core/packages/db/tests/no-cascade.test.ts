import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER } from '../src/migrate.js'
import { withClient, workerDatabase } from '../src/testing/index.js'

/** Ни одного ON DELETE / ON UPDATE CASCADE: политика FK — NO ACTION (§5.1, §21). */
describe('foreign key delete policy', () => {
  it('every foreign key in the migrated schema is NO ACTION', async () => {
    const db = await workerDatabase()
    const fks = await withClient(db.migrateUrl, (client) =>
      client.query<{ name: string; on_delete: string; on_update: string }>(`
        SELECT conname AS name, confdeltype AS on_delete, confupdtype AS on_update
          FROM pg_constraint
         WHERE contype = 'f' AND connamespace = 'public'::regnamespace
         ORDER BY 1`),
    )
    expect(fks.rows.map((row) => row.name)).toEqual([
      'outbox_dead_letter_event_id_fkey',
      'outbox_event_id_fkey',
    ])
    expect(fks.rows.filter((row) => row.on_delete === 'c' || row.on_update === 'c')).toEqual([])
    expect(fks.rows.every((row) => row.on_delete === 'a' && row.on_update === 'a')).toBe(true)
  })

  it('no migration file mentions CASCADE', () => {
    for (const file of readdirSync(MIGRATIONS_FOLDER).filter((name) => name.endsWith('.sql'))) {
      const text = readFileSync(join(MIGRATIONS_FOLDER, file), 'utf8')
      expect(text, file).not.toMatch(/cascade/i)
    }
  })
})
