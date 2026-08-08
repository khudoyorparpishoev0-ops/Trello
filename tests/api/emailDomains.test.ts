/**
 * Тесты ограничения регистрации корпоративными доменами.
 * Запуск: npm run test:api
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDomains, emailDomain, isEmailAllowed, domainsHint } from '../../api/emailDomains.js'

const DEFAULT = ['ithona.tj', 'fazo-tech.tj']

// ——— Разбор настройки ———

test('переменная не задана — действуют домены по умолчанию', () => {
  assert.deepEqual(parseDomains(undefined), DEFAULT)
  assert.deepEqual(parseDomains(null), DEFAULT)
})

test('пустое значение НЕ снимает ограничение (защита от опечатки в .env)', () => {
  assert.deepEqual(parseDomains(''), DEFAULT)
  assert.deepEqual(parseDomains('   '), DEFAULT)
  assert.deepEqual(parseDomains(',,,'), DEFAULT)
})

test('снять ограничение можно только явно, значением «*»', () => {
  assert.deepEqual(parseDomains('*'), [])
  assert.equal(isEmailAllowed('кто-угодно@gmail.com', parseDomains('*')), true)
})

test('список разбирается, регистр и «@» нормализуются', () => {
  assert.deepEqual(parseDomains('ITHONA.TJ, @fazo-tech.tj ,example.com'), [
    'ithona.tj',
    'fazo-tech.tj',
    'example.com',
  ])
})

// ——— Выделение домена ———

test('домен адреса выделяется корректно', () => {
  assert.equal(emailDomain('ivan@ithona.tj'), 'ithona.tj')
  assert.equal(emailDomain('  Ivan@ITHONA.tj  '), 'ithona.tj')
  assert.equal(emailDomain('a@b@fazo-tech.tj'), 'fazo-tech.tj') // берётся последняя «@»
})

test('некорректные адреса домена не дают', () => {
  for (const bad of ['', 'ivan', '@ithona.tj', 'ivan@', 'ivan.ithona.tj', null, undefined]) {
    assert.equal(emailDomain(bad as string), '', `должно быть пусто для ${JSON.stringify(bad)}`)
  }
})

// ——— Проверка допуска ———

test('почта разрешённых доменов проходит', () => {
  assert.equal(isEmailAllowed('ivan@ithona.tj', DEFAULT), true)
  assert.equal(isEmailAllowed('khudoyor@fazo-tech.tj', DEFAULT), true)
})

test('регистр не важен', () => {
  assert.equal(isEmailAllowed('Ivan@ITHONA.TJ', DEFAULT), true)
  assert.equal(isEmailAllowed('  ivan@Fazo-Tech.tj  ', DEFAULT), true)
})

test('посторонняя почта отклоняется', () => {
  for (const bad of [
    'ivan@gmail.com',
    'ivan@mail.ru',
    'ivan@yandex.ru',
    'ivan@ithona.com', // другая зона
    'ivan@ithona.ru',
  ]) {
    assert.equal(isEmailAllowed(bad, DEFAULT), false, `${bad} не должен проходить`)
  }
})

test('поддомены не проходят — сравнение точное', () => {
  assert.equal(isEmailAllowed('ivan@mail.ithona.tj', DEFAULT), false)
})

test('подделка домена в хвосте не проходит', () => {
  // Классический обход: «наш» домен как часть чужого.
  for (const bad of [
    'ivan@ithona.tj.evil.com',
    'ivan@evil-ithona.tj',
    'ivan@fazo-tech.tj.attacker.net',
    'ivan@notithona.tj',
  ]) {
    assert.equal(isEmailAllowed(bad, DEFAULT), false, `${bad} не должен проходить`)
  }
})

test('адрес без «@» и мусор отклоняются', () => {
  for (const bad of ['', '   ', 'ivan', 'ivan.ithona.tj', '@ithona.tj', 'ivan@']) {
    assert.equal(isEmailAllowed(bad, DEFAULT), false)
  }
})

test('подсказка перечисляет домены со знаком «@»', () => {
  assert.equal(domainsHint(DEFAULT), '@ithona.tj или @fazo-tech.tj')
})

test('настроенный список заменяет домены по умолчанию', () => {
  const custom = parseDomains('example.com')
  assert.equal(isEmailAllowed('ivan@example.com', custom), true)
  assert.equal(isEmailAllowed('ivan@ithona.tj', custom), false)
})
