import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import * as schema from '../src/schema/index.js'
import { withClient, workerDatabase } from '../src/testing/index.js'

/**
 * Drift: база, полученная применением миграций, совпадает со схемой Drizzle
 * (таблицы, колонки, типы, NOT NULL, DEFAULT, PK, FK, CHECK, индексы).
 * Вторая половина проверки — CI job `migrations`: `drizzle-kit generate` не должен
 * порождать новых файлов.
 */
const tables = Object.values(schema as Record<string, unknown>).filter((value): value is PgTable =>
  is(value, PgTable),
)

interface DbColumn {
  table: string
  column: string
  type: string
  not_null: boolean
  has_default: boolean
}

describe('schema drift', () => {
  it('migrated database matches the Drizzle schema exactly', async () => {
    const db = await workerDatabase()
    const snapshot = await withClient(db.migrateUrl, async (client) => {
      const columns = await client.query<DbColumn>(`
        SELECT c.relname AS table, a.attname AS column, format_type(a.atttypid, a.atttypmod) AS type,
               a.attnotnull AS not_null, a.atthasdef AS has_default
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
         WHERE c.relnamespace = 'public'::regnamespace AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY 1, a.attnum`)
      const constraints = await client.query<{
        table: string
        name: string
        type: string
        columns: string[]
      }>(`
        SELECT con.conrelid::regclass::text AS table, con.conname AS name, con.contype AS type,
               CASE WHEN con.contype IN ('p', 'f') THEN
                 ARRAY(SELECT pa.attname FROM unnest(con.conkey) WITH ORDINALITY AS k(num, ord)
                         JOIN pg_attribute pa ON pa.attrelid = con.conrelid AND pa.attnum = k.num
                        ORDER BY k.ord)::text[]
               ELSE ARRAY[]::text[] END AS columns
          FROM pg_constraint con WHERE con.connamespace = 'public'::regnamespace
         ORDER BY 1, 2`)
      const indexes = await client.query<{ table: string; name: string; partial: boolean }>(`
        SELECT t.relname AS table, i.relname AS name, x.indpred IS NOT NULL AS partial
          FROM pg_index x
          JOIN pg_class i ON i.oid = x.indexrelid
          JOIN pg_class t ON t.oid = x.indrelid
         WHERE t.relnamespace = 'public'::regnamespace AND NOT x.indisprimary
         ORDER BY 1, 2`)
      return { columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows }
    })

    const expectedColumns: DbColumn[] = []
    const expectedConstraints: { table: string; name: string; type: string; columns: string[] }[] =
      []
    const expectedIndexes: { table: string; name: string; partial: boolean }[] = []

    for (const table of tables) {
      const config = getTableConfig(table)
      for (const column of config.columns) {
        expectedColumns.push({
          table: config.name,
          column: column.name,
          type: column.getSQLType(),
          not_null: column.notNull,
          has_default: column.hasDefault,
        })
      }
      const pkColumns =
        config.primaryKeys[0]?.columns.map((c) => c.name) ??
        config.columns.filter((c) => c.primary).map((c) => c.name)
      const pkName = config.primaryKeys[0]?.getName() ?? `${config.name}_pkey`
      expectedConstraints.push({ table: config.name, name: pkName, type: 'p', columns: pkColumns })
      for (const fk of config.foreignKeys) {
        const ref = fk.reference()
        expectedConstraints.push({
          table: config.name,
          name: fk.getName(),
          type: 'f',
          columns: ref.columns.map((c) => c.name),
        })
        expect(fk.onDelete ?? 'no action').toBe('no action')
      }
      for (const check of config.checks) {
        expectedConstraints.push({ table: config.name, name: check.name, type: 'c', columns: [] })
      }
      for (const index of config.indexes) {
        expectedIndexes.push({
          table: config.name,
          name: index.config.name as string,
          partial: index.config.where !== undefined,
        })
      }
    }

    const byKey = <T extends { table: string }>(rows: T[], key: (row: T) => string) =>
      [...rows].sort((a, b) => key(a).localeCompare(key(b)))

    expect(byKey(snapshot.columns, (r) => `${r.table}.${r.column}`)).toEqual(
      byKey(expectedColumns, (r) => `${r.table}.${r.column}`),
    )
    expect(byKey(snapshot.constraints, (r) => `${r.table}.${r.name}`)).toEqual(
      byKey(expectedConstraints, (r) => `${r.table}.${r.name}`),
    )
    expect(byKey(snapshot.indexes, (r) => `${r.table}.${r.name}`)).toEqual(
      byKey(expectedIndexes, (r) => `${r.table}.${r.name}`),
    )
  })
})
