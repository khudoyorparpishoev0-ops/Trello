import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { truncateAll, withClient, workerDatabase } from '../src/testing/index.js'
import { sqlState } from './helpers.js'

/** Роли БД (§14.6, §23.7): hona_app — только DML, domain_events — только дописывается. */
const INSUFFICIENT_PRIVILEGE = '42501'

afterEach(async () => truncateAll(await workerDatabase()))

describe('hona_app', () => {
  it.each([
    ['CREATE TABLE', 'CREATE TABLE app_ddl_probe (id int)'],
    ['CREATE SCHEMA', 'CREATE SCHEMA app_probe'],
    ['CREATE TEMP TABLE', 'CREATE TEMP TABLE app_tmp_probe (id int)'],
    ['ALTER TABLE', 'ALTER TABLE outbox ADD COLUMN probe int'],
    ['DROP TABLE', 'DROP TABLE outbox_dead_letter'],
    ['TRUNCATE', 'TRUNCATE outbox'],
    ['CREATE INDEX', 'CREATE INDEX probe_idx ON outbox (company_id)'],
    ['CREATE FUNCTION', 'CREATE FUNCTION probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'],
    ['read migrator journal', 'SELECT * FROM drizzle.__drizzle_migrations'],
  ])('cannot %s', async (_label, statement) => {
    const db = await workerDatabase()
    const code = await withClient(db.appUrl, (client) => sqlState(client, statement))
    expect(code).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('appends to domain_events but can neither update nor delete it', async () => {
    const db = await workerDatabase()
    await withClient(db.appUrl, async (client) => {
      const id = randomUUID()
      await client.query(
        `INSERT INTO domain_events (id, company_id, type, entity_type, entity_id, actor_kind, payload)
         VALUES ($1, $2, 'system.ping', 'system', $1, 'system', '{"note":"x"}')`,
        [id, randomUUID()],
      )
      expect((await client.query('SELECT 1 FROM domain_events WHERE id = $1', [id])).rowCount).toBe(
        1,
      )
      expect(
        await sqlState(client, "UPDATE domain_events SET type = 'x' WHERE id = $1", [id]),
      ).toBe(INSUFFICIENT_PRIVILEGE)
      expect(await sqlState(client, 'DELETE FROM domain_events WHERE id = $1', [id])).toBe(
        INSUFFICIENT_PRIVILEGE,
      )
    })
  })

  it('has full DML on outbox and outbox_dead_letter', async () => {
    const db = await workerDatabase()
    await withClient(db.appUrl, async (client) => {
      const id = randomUUID()
      const company = randomUUID()
      await client.query(
        `INSERT INTO domain_events (id, company_id, type, entity_type, entity_id, actor_kind, payload)
         VALUES ($1, $2, 'system.ping', 'system', $1, 'system', '{}')`,
        [id, company],
      )
      await client.query(
        "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'noop', $2)",
        [id, company],
      )
      await client.query("UPDATE outbox SET status = 'processing' WHERE event_id = $1", [id])
      await client.query('DELETE FROM outbox WHERE event_id = $1', [id])
      await client.query(
        "INSERT INTO outbox_dead_letter (event_id, handler, company_id, attempts, last_error) VALUES ($1, 'noop', $2, 12, 'e')",
        [id, company],
      )
      await client.query('UPDATE outbox_dead_letter SET retried_at = now() WHERE event_id = $1', [
        id,
      ])
      await client.query('DELETE FROM outbox_dead_letter WHERE event_id = $1', [id])
    })
  })
})

describe('hona_readonly', () => {
  it('can only read', async () => {
    const db = await workerDatabase()
    await withClient(db.readonlyUrl, async (client) => {
      expect((await client.query('SELECT count(*) FROM domain_events')).rowCount).toBe(1)
      expect((await client.query('SELECT count(*) FROM outbox')).rowCount).toBe(1)
      expect(
        await sqlState(
          client,
          "INSERT INTO outbox (event_id, handler, company_id) VALUES ($1, 'x', $1)",
          [randomUUID()],
        ),
      ).toBe(INSUFFICIENT_PRIVILEGE)
      expect(await sqlState(client, 'CREATE TABLE ro_probe (id int)')).toBe(INSUFFICIENT_PRIVILEGE)
    })
  })
})

describe('role attributes', () => {
  it('no hona role is superuser or can create databases or roles', async () => {
    const db = await workerDatabase()
    const roles = await withClient(db.migrateUrl, (client) =>
      client.query(
        `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
           FROM pg_roles WHERE rolname LIKE 'hona\\_%' ORDER BY 1`,
      ),
    )
    expect(roles.rows).toEqual(
      ['hona_app', 'hona_migrate', 'hona_readonly'].map((rolname) => ({
        rolname,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolbypassrls: false,
        rolcanlogin: true,
      })),
    )
  })
})
