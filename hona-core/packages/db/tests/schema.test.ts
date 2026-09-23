import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { truncateAll, withClient, workerDatabase } from '../src/testing/index.js'
import { sqlState } from './helpers.js'

/** Каждый CHECK, PK и FK фундамента срабатывает (§15.2 Database). */
afterEach(async () => truncateAll(await workerDatabase()))

async function asApp<T>(fn: Parameters<typeof withClient<T>>[1]): Promise<T> {
  return withClient((await workerDatabase()).appUrl, fn)
}

const insertEvent = `INSERT INTO domain_events (id, company_id, type, entity_type, entity_id, actor_kind, via, payload)
                     VALUES ($1, $2, 'system.ping', 'system', $1, $3, $4, '{"note":"x"}')`

describe('domain_events', () => {
  it('enforces actor_kind and via CHECK constraints; via may be NULL', async () => {
    await asApp(async (client) => {
      expect(await sqlState(client, insertEvent, [randomUUID(), randomUUID(), 'robot', null])).toBe(
        '23514',
      )
      expect(
        await sqlState(client, insertEvent, [randomUUID(), randomUUID(), 'system', 'fax']),
      ).toBe('23514')
      expect(
        await sqlState(client, insertEvent, [randomUUID(), randomUUID(), 'system', null]),
      ).toBeNull()
      expect(
        await sqlState(client, insertEvent, [randomUUID(), randomUUID(), 'user', 'web']),
      ).toBeNull()
    })
  })

  it('defaults occurred_at to now() and actor_kind to user', async () => {
    await asApp(async (client) => {
      const id = randomUUID()
      await client.query(
        `INSERT INTO domain_events (id, company_id, type, entity_type, entity_id, payload)
         VALUES ($1, $1, 't', 'e', $1, '{}')`,
        [id],
      )
      const row = await client.query<{ actor_kind: string; fresh: boolean }>(
        "SELECT actor_kind, occurred_at > now() - interval '1 minute' AS fresh FROM domain_events WHERE id = $1",
        [id],
      )
      expect(row.rows[0]).toEqual({ actor_kind: 'user', fresh: true })
    })
  })
})

describe('outbox', () => {
  it('requires an existing event (FK) and a valid status (CHECK)', async () => {
    await asApp(async (client) => {
      expect(
        await sqlState(
          client,
          "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'noop', $1)",
          [randomUUID()],
        ),
      ).toBe('23503')
      const id = randomUUID()
      await client.query(insertEvent, [id, randomUUID(), 'system', null])
      expect(
        await sqlState(
          client,
          "INSERT INTO outbox (event_id, handler, company_id, status) VALUES ($1, 'noop', $1, 'lost')",
          [id],
        ),
      ).toBe('23514')
    })
  })

  it('has one row per (event, handler) and sensible defaults', async () => {
    await asApp(async (client) => {
      const id = randomUUID()
      await client.query(insertEvent, [id, randomUUID(), 'system', null])
      await client.query(
        "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'noop', $1)",
        [id],
      )
      await client.query(
        "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'realtime', $1)",
        [id],
      )
      expect(
        await sqlState(
          client,
          "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'noop', $1)",
          [id],
        ),
      ).toBe('23505')
      const row = await client.query(
        "SELECT status, attempts, locked_by, next_attempt_at <= now() AS due FROM outbox WHERE handler = 'noop'",
      )
      expect(row.rows[0]).toEqual({ status: 'pending', attempts: 0, locked_by: null, due: true })
    })
  })

  it('an event with outbox or dead-letter rows cannot be deleted (NO ACTION, nothing cascades)', async () => {
    const db = await workerDatabase()
    const id = randomUUID()
    await withClient(db.appUrl, async (client) => {
      await client.query(insertEvent, [id, randomUUID(), 'system', null])
      await client.query(
        "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'noop', $1)",
        [id],
      )
      await client.query(
        "INSERT INTO outbox_dead_letter (event_id, handler, company_id, attempts, last_error) VALUES ($1, 'x', $1, 12, 'e')",
        [id],
      )
    })
    // Удаляет владелец таблиц: у hona_app нет DELETE на журнал вовсе.
    await withClient(db.migrateUrl, async (client) => {
      expect(await sqlState(client, 'DELETE FROM domain_events WHERE id = $1', [id])).toBe('23503')
      const left = await client.query(
        `SELECT (SELECT count(*) FROM outbox WHERE event_id = $1)::int AS outbox,
                (SELECT count(*) FROM outbox_dead_letter WHERE event_id = $1)::int AS dead`,
        [id],
      )
      expect(left.rows[0]).toEqual({ outbox: 1, dead: 1 })
    })
  })
})

describe('foundation types and functions', () => {
  it('all *_at columns are timestamptz and the only jsonb column is domain_events.payload', async () => {
    const db = await workerDatabase()
    await withClient(db.migrateUrl, async (client) => {
      const cols = await client.query<{
        table_name: string
        column_name: string
        data_type: string
      }>(
        "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'",
      )
      for (const col of cols.rows.filter((c) => c.column_name.endsWith('_at'))) {
        expect(col.data_type, `${col.table_name}.${col.column_name}`).toBe(
          'timestamp with time zone',
        )
      }
      const jsonb = cols.rows
        .filter((c) => c.data_type === 'jsonb')
        .map((c) => `${c.table_name}.${c.column_name}`)
      expect(jsonb).toEqual(['domain_events.payload'])
    })
  })

  it('citext compares case-insensitively', async () => {
    await asApp(async (client) => {
      const res = await client.query(
        "SELECT 'Admin@IT-HONA.tj'::citext = 'admin@it-hona.tj'::citext AS same",
      )
      expect(res.rows[0]).toEqual({ same: true })
    })
  })

  it('set_updated_at() refreshes updated_at on UPDATE', async () => {
    const db = await workerDatabase()
    await withClient(db.migrateUrl, async (client) => {
      await client.query(
        "CREATE TEMP TABLE touch_probe (id int PRIMARY KEY, v text, updated_at timestamptz NOT NULL DEFAULT '2000-01-01')",
      )
      await client.query(
        'CREATE TRIGGER touch_probe_updated_at BEFORE UPDATE ON touch_probe FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      )
      await client.query("INSERT INTO touch_probe (id, v) VALUES (1, 'a')")
      await client.query("UPDATE touch_probe SET v = 'b' WHERE id = 1")
      const row = await client.query<{ touched: boolean }>(
        "SELECT updated_at > now() - interval '1 minute' AS touched FROM touch_probe WHERE id = 1",
      )
      expect(row.rows[0]).toEqual({ touched: true })
    })
  })
})
