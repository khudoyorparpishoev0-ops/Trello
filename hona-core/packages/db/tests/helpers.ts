import type pg from 'pg'

/** Результат запроса, который должен упасть: код SQLSTATE или null, если не упал. */
export async function sqlState(
  client: pg.Client,
  text: string,
  values: unknown[] = [],
): Promise<string | null> {
  try {
    await client.query(text, values)
    return null
  } catch (err) {
    return (err as { code?: string }).code ?? 'unknown'
  }
}

/** Снимок каталога схемы public — для сравнения «до» и «после» повторной миграции. */
export async function catalogSnapshot(client: pg.Client): Promise<string> {
  // Последовательно: один pg.Client не выполняет запросы параллельно.
  const queries = [
    `
      SELECT c.relname, c.relkind, a.attname, format_type(a.atttypid, a.atttypmod) AS type,
             a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS default
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
       ORDER BY c.relname, a.attnum`,
    `
      SELECT conrelid::regclass::text AS rel, conname, pg_get_constraintdef(oid) AS def
        FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2`,
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1`,
    `
      SELECT p.proname, pg_get_functiondef(p.oid) AS def FROM pg_proc p
       WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
         AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
       ORDER BY 1`,
    `SELECT extname, extversion FROM pg_extension ORDER BY 1`,
    `
      SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
       WHERE table_schema = 'public' ORDER BY 1, 2, 3`,
  ]
  const parts: unknown[] = []
  for (const text of queries) parts.push((await client.query(text)).rows)
  return JSON.stringify(parts)
}
