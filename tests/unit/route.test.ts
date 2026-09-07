/**
 * Тесты адресации разделов. Запуск: npm run test:unit
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute, buildPath, type Route } from '@/lib/route'

// ——— Разбор ———

test('корень — это доска', () => {
  assert.deepEqual(parseRoute('/'), { view: 'board', boardId: null, boardView: 'board', cardId: null })
})

test('разделы разбираются по первому сегменту', () => {
  assert.equal(parseRoute('/dashboard').view, 'dashboard')
  assert.equal(parseRoute('/team').view, 'team')
  assert.equal(parseRoute('/calendar').view, 'calendar')
  assert.equal(parseRoute('/company').view, 'company')
  assert.equal(parseRoute('/reports').view, 'reports')
})

test('настройки адресуются как /settings, а не /profile', () => {
  assert.equal(parseRoute('/settings').view, 'profile')
  assert.equal(buildPath({ view: 'profile', boardId: null, boardView: 'board', cardId: null }), '/settings')
})

test('доска и её вид', () => {
  assert.deepEqual(parseRoute('/board/b1'), { view: 'board', boardId: 'b1', boardView: 'board', cardId: null })
  assert.equal(parseRoute('/board/b1/timeline').boardView, 'timeline')
  assert.equal(parseRoute('/board/b1/table').boardView, 'table')
})

test('неизвестный вид доски не ломает адрес — открывается канбан', () => {
  assert.equal(parseRoute('/board/b1/зззz').boardView, 'board')
})

test('неизвестный путь открывает доску: страницы 404 в системе нет', () => {
  assert.equal(parseRoute('/чего-то-нет').view, 'board')
  assert.equal(parseRoute('/чего-то-нет').boardId, null)
})

test('карточка приходит параметром запроса и живёт поверх любого раздела', () => {
  assert.equal(parseRoute('/dashboard', '?card=c1').cardId, 'c1')
  assert.equal(parseRoute('/board/b1/table', '?card=c1').cardId, 'c1')
  assert.equal(parseRoute('/board/b1').cardId, null)
})

test('прежние ссылки /?board=<id> продолжают работать', () => {
  // Их уже разослали кнопкой «Скопировать ссылку» — ломать нельзя.
  assert.equal(parseRoute('/', '?board=b7').boardId, 'b7')
  assert.equal(parseRoute('/', '?board=b7').view, 'board')
})

test('параметр board учитывается только на корне: в пути доска уже названа', () => {
  assert.equal(parseRoute('/board/b1', '?board=b7').boardId, 'b1')
  assert.equal(parseRoute('/team', '?board=b7').view, 'team')
})

// ——— Сборка ———

const route = (patch: Partial<Route>): Route => ({
  view: 'board',
  boardId: null,
  boardView: 'board',
  cardId: null,
  ...patch,
})

test('адрес доски собирается с видом и карточкой', () => {
  assert.equal(buildPath(route({ boardId: 'b1' })), '/board/b1')
  assert.equal(buildPath(route({ boardId: 'b1', boardView: 'timeline' })), '/board/b1/timeline')
  assert.equal(buildPath(route({ boardId: 'b1', cardId: 'c2' })), '/board/b1?card=c2')
  assert.equal(buildPath(route({ view: 'dashboard', cardId: 'c2' })), '/dashboard?card=c2')
})

test('без известной доски вид в адрес не пишется — подставлять нечего', () => {
  assert.equal(buildPath(route({ boardView: 'table' })), '/board')
})

test('идентификаторы экранируются', () => {
  assert.equal(buildPath(route({ boardId: 'a b/c' })), '/board/a%20b%2Fc')
  assert.equal(buildPath(route({ boardId: 'b1', cardId: 'c d' })), '/board/b1?card=c%20d')
})

test('разбор и сборка обратимы', () => {
  for (const path of ['/dashboard', '/team', '/board/b1', '/board/b1/table', '/settings']) {
    assert.equal(buildPath(parseRoute(path)), path)
  }
})
