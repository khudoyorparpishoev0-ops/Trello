import { domainEvents, outbox, type DbHandle } from '@hona/db'
import { appDb, truncateAll, withClient, workerDatabase, type TestDatabase } from '@hona/db/testing'
import { SYSTEM_COMPANY_ID } from '@hona/shared'
import { eq } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { memoryLogger } from '../../../test/fixtures.js'
import { systemContext } from '../context.js'
import { newId } from '../ids.js'
import { withTransaction } from '../tx.js'
import { emit } from './emit.js'

/** §10.4, §23.8 Events: событие + outbox в одной транзакции, NOTIFY только после COMMIT. */
let database: TestDatabase
let handle: DbHandle

beforeAll(async () => {
  database = await workerDatabase()
  handle = appDb(database)
})
afterAll(async () => handle.close())
beforeEach(async () => truncateAll(database))

const ctx = () =>
  systemContext({ requestId: '01J8Z3K4M5N6P7Q8R9S0T1V2W3', log: memoryLogger().logger })
const entity = () => ({ type: 'system', id: newId() })

async function counts() {
  const events = await handle.db.select().from(domainEvents)
  const rows = await handle.db.select().from(outbox)
  return { events, rows }
}

describe('emit()', () => {
  it('writes the event and one outbox row per handler in the same transaction', async () => {
    const target = entity()
    const eventId = await withTransaction(handle.db, (tx) =>
      emit(tx, ctx(), 'system.ping', target, { note: 'atomic' }),
    )
    const { events, rows } = await counts()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      id: eventId,
      companyId: SYSTEM_COMPANY_ID,
      type: 'system.ping',
      entityType: 'system',
      entityId: target.id,
      actorUserId: null,
      actorKind: 'system',
      via: null,
      payload: { note: 'atomic' },
      requestId: '01J8Z3K4M5N6P7Q8R9S0T1V2W3',
    })
    expect(rows).toEqual([
      expect.objectContaining({
        eventId,
        handler: 'noop',
        companyId: SYSTEM_COMPANY_ID,
        status: 'pending',
        attempts: 0,
      }),
    ])
  })

  it('leaves nothing behind when the surrounding transaction rolls back', async () => {
    await expect(
      withTransaction(handle.db, async (tx) => {
        await emit(tx, ctx(), 'system.ping', entity(), { note: 'first' })
        await emit(tx, ctx(), 'system.ping', entity(), { note: 'second' })
        throw new Error('business rule failed after emit')
      }),
    ).rejects.toThrow('business rule failed after emit')
    const { events, rows } = await counts()
    expect(events).toEqual([])
    expect(rows).toEqual([])
  })

  it('an invalid payload throws and rolls back everything written earlier in the transaction', async () => {
    await expect(
      withTransaction(handle.db, async (tx) => {
        await emit(tx, ctx(), 'system.ping', entity(), { note: 'valid' })
        // Тип верен (string), но схема требует непустой note — отказ в runtime через zod
        await emit(tx, ctx(), 'system.ping', entity(), { note: '' })
      }),
    ).rejects.toBeInstanceOf(ZodError)
    const { events, rows } = await counts()
    expect(events).toEqual([])
    expect(rows).toEqual([])
  })

  it('cannot be called outside a transaction (compile-time guarantee)', () => {
    const run = () =>
      // @ts-expect-error — Db не является Tx: у него нет rollback(), emit принимает только транзакцию
      emit(handle.db, ctx(), 'system.ping', entity(), { note: 'no tx' })
    expect(typeof run).toBe('function')
  })

  it('delivers NOTIFY outbox_new only after COMMIT', async () => {
    await withClient(database.appUrl, async (listener: pg.Client) => {
      const received: string[] = []
      listener.on('notification', (message) => received.push(message.channel))
      await listener.query('LISTEN outbox_new')
      const committed = new Promise<void>((resolve) =>
        listener.on('notification', (message) => {
          if (message.channel === 'outbox_new') resolve()
        }),
      )

      await withTransaction(handle.db, async (tx) => {
        await emit(tx, ctx(), 'system.ping', entity(), { note: 'notify' })
        // Круг до сервера на соединении слушателя: уже отправленное уведомление пришло бы до ответа.
        await listener.query('SELECT 1')
        expect(received).toEqual([])
      })

      await committed
      expect(received).toContain('outbox_new')
    })
  })

  it('no NOTIFY escapes a rolled-back transaction', async () => {
    await withClient(database.appUrl, async (listener: pg.Client) => {
      const received: string[] = []
      listener.on('notification', (message) => received.push(message.channel))
      await listener.query('LISTEN outbox_new')
      await expect(
        withTransaction(handle.db, async (tx) => {
          await emit(tx, ctx(), 'system.ping', entity(), { note: 'rollback' })
          throw new Error('abort')
        }),
      ).rejects.toThrow('abort')
      await listener.query('SELECT 1')
      expect(received).toEqual([])
    })
  })

  it('runs as hona_app, the application role', async () => {
    const rows = await handle.db.execute<{ role: string }>(
      // current_user — роль сессии пула приложения
      (await import('drizzle-orm')).sql`SELECT current_user AS role`,
    )
    expect(rows.rows[0]?.role).toBe('hona_app')
    const [first] = await handle.db.select().from(domainEvents).where(eq(domainEvents.id, newId()))
    expect(first).toBeUndefined()
  })
})
