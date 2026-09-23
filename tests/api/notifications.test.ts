/**
 * Уведомления Telegram после перехода на общий набор изменений (фаза 2).
 *
 * Проверяется не текст сообщений, а то, ради чего переход делался: свои
 * сравнения prev/next из уведомлений ушли, а поведение осталось прежним —
 * тем же адресатам, по тем же поводам, без автора изменения.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { diffBoardState } from '../../shared/domain/diff.ts'
import type { AppData } from '../../shared/domain/types.ts'
import { fixture } from '../unit/fixture.ts'

// Токен читается модулем при загрузке, поэтому импорт динамический.
process.env.TELEGRAM_BOT_TOKEN = '0:ТЕСТОВЫЙ'
const { notifyAssignments, notifyDueChanges } = await import('../../api/telegram.js')

/** Пул, который запоминает, кого спрашивали, и никого не находит. */
function spyPool() {
  const asked: string[] = []
  return {
    asked,
    query: async (_sql: string, params: unknown[]) => {
      asked.push(String(params?.[0]))
      return { rows: [] }
    },
  }
}

function clone(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData
}

test('в уведомлениях не осталось собственного сравнения состояний', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync('api/telegram.js', 'utf8')
  assert.ok(!src.includes('oldData'), 'старое состояние в модуль уведомлений больше не приходит')
  assert.ok(!src.includes('oldCards'), 'своего разбора карточек здесь быть не должно')
})

test('о назначении сообщают назначенным, кроме того, кто назначал', async () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c3.assigneeIds = ['u1', 'u2', 'u3']
  const cs = diffBoardState(prev, next)

  const pool = spyPool()
  await notifyAssignments(pool, cs, 'u1', 'Алиса')
  assert.deepEqual(pool.asked.sort(), ['u2', 'u3'], 'автору изменения себе не пишут')
})

test('назначение на новой карточке тоже уведомляет — как и раньше', async () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.fresh = {
    id: 'fresh',
    title: 'Новая',
    labelIds: [],
    assigneeIds: ['u2'],
    priority: 'medium',
    checklists: [],
    comments: [],
    attachments: [],
    createdAt: '2026-03-10T00:00:00.000Z',
  }
  next.lists.l1.cardIds.push('fresh')

  const pool = spyPool()
  await notifyAssignments(pool, diffBoardState(prev, next), 'u1', 'Алиса')
  assert.deepEqual(pool.asked, ['u2'])
})

test('о смене срока сообщают исполнителям задачи', async () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.c5.dueDate = '2026-03-20T12:00:00.000Z'

  const pool = spyPool()
  await notifyDueChanges(pool, diffBoardState(prev, next), 'u1', 'Алиса')
  // c5 назначена на u1 и u2; u1 менял — ему не пишут.
  assert.deepEqual(pool.asked, ['u2'])
})

test('у новой карточки срок не «менялся» — уведомления нет', async () => {
  const prev = fixture()
  const next = clone(prev)
  next.cards.fresh2 = {
    id: 'fresh2',
    title: 'Новая со сроком',
    labelIds: [],
    assigneeIds: ['u2'],
    priority: 'medium',
    dueDate: '2026-03-20T12:00:00.000Z',
    checklists: [],
    comments: [],
    attachments: [],
    createdAt: '2026-03-10T00:00:00.000Z',
  }
  next.lists.l1.cardIds.push('fresh2')

  const pool = spyPool()
  await notifyDueChanges(pool, diffBoardState(prev, next), 'u1', 'Алиса')
  assert.deepEqual(pool.asked, [], 'поведение прежнее: создание — не изменение срока')
})

test('пустой набор изменений не трогает базу', async () => {
  const data = fixture()
  const cs = diffBoardState(data, clone(data))
  const pool = spyPool()
  await notifyAssignments(pool, cs, 'u1', 'Алиса')
  await notifyDueChanges(pool, cs, 'u1', 'Алиса')
  assert.deepEqual(pool.asked, [])
})
