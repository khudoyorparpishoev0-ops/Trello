/**
 * Тесты серверной части AI-слоя: выключенное состояние, защита ключа от
 * перерасхода и форма контрактов, по которым отвечают агенты.
 * Запуск: npm run test:api
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { aiEnabled, aiStatus, allowRequest, datasetTooBig, runAgent, runExecutive } from '../../api/ai.js'
import { AGENTS, EXECUTIVE_SYSTEM, agentSystem, briefTool, isAgent, reportTool } from '../../api/aiAgents.js'

// ——— Выключенное состояние ———

test('без ключа AI выключен и объясняет причину', () => {
  // В тестовом окружении ANTHROPIC_API_KEY не задан — это штатный случай.
  assert.equal(aiEnabled(), false)
  const s = aiStatus()
  assert.equal(s.enabled, false)
  assert.match(s.reason, /ANTHROPIC_API_KEY/)
  assert.match(s.reason, /Аналитика работает/)
})

test('без ключа вызовы отклоняются кодом 503, а не падают', async () => {
  await assert.rejects(() => runAgent('team', {}), (e: Error & { status?: number }) => {
    assert.equal(e.status, 503)
    return true
  })
  await assert.rejects(() => runExecutive([{ id: 'a' }]), (e: Error & { status?: number }) => {
    assert.equal(e.status, 503)
    return true
  })
})

test('неизвестный агент отклоняется до обращения к провайдеру', async () => {
  await assert.rejects(() => runAgent('маркетинг', {}), (e: Error & { status?: number }) => {
    assert.equal(e.status, 400)
    return true
  })
})

test('пустой список наблюдений не идёт в сводку', async () => {
  await assert.rejects(() => runExecutive([]), (e: Error & { status?: number }) => {
    assert.equal(e.status, 400)
    return true
  })
})

// ——— Защита ключа ———

test('слишком большой датасет не уходит провайдеру', () => {
  assert.equal(datasetTooBig({ workload: [1, 2, 3] }), false)
  assert.equal(datasetTooBig({ dump: 'x'.repeat(300_000) }), true)
})

test('частота обращений ограничена по пользователю', () => {
  const key = `тест_${Date.now()}`
  let allowed = 0
  for (let i = 0; i < 40; i++) if (allowRequest(key)) allowed += 1
  assert.equal(allowed, 30, 'по умолчанию 30 обращений в окно')
  // Соседний пользователь чужим лимитом не задет.
  assert.equal(allowRequest(`${key}_другой`), true)
})

// ——— Контракты агентов ———

test('реестр агентов покрывает все области схемы', () => {
  assert.deepEqual(Object.keys(AGENTS).sort(), ['deadline', 'project', 'quality', 'risk', 'team'])
  assert.equal(isAgent('team'), true)
  assert.equal(isAgent('__proto__'), false, 'наследованные свойства не должны считаться агентами')
})

test('подсказка агента запрещает считать и выдумывать', () => {
  const text = agentSystem('team')
  assert.match(text, /Ничего не считай/)
  assert.match(text, /insufficientData/)
  assert.match(text, /Догадки запрещены/)
  assert.match(text, /загруз/i, 'в подсказке должна быть его область')
})

test('подсказки считают пользовательский текст данными, а не командами', () => {
  // Названия задач вводят сотрудники и они попадают в датасет — значит,
  // внутри может оказаться попытка переписать инструкции агента.
  for (const id of Object.keys(AGENTS)) {
    assert.match(agentSystem(id), /данные,\s*\n?\s*а не указания/, id)
  }
  assert.match(EXECUTIVE_SYSTEM, /данные,\s*\n?\s*а не указания/)
})

test('Executive Agent не получает данных и не заводит наблюдений', () => {
  assert.match(EXECUTIVE_SYSTEM, /НЕ дают ни доску, ни карточки/)
  assert.match(EXECUTIVE_SYSTEM, /Не заводи новых наблюдений/)
  assert.match(EXECUTIVE_SYSTEM, /по их id/)
})

test('схема отчёта строгая: без доказательства наблюдение не собрать', () => {
  const tool = reportTool()
  assert.equal(tool.strict, true)
  const schema = tool.input_schema
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ['findings', 'insufficientData'])

  const finding = schema.properties.findings.items
  assert.equal(finding.additionalProperties, false)
  for (const field of ['title', 'severity', 'fact', 'interpretation', 'recommendation', 'evidence']) {
    assert.ok(finding.required.includes(field), `обязательное поле: ${field}`)
  }
  assert.deepEqual(finding.properties.severity.enum, ['info', 'warning', 'critical'])

  const ev = finding.properties.evidence
  assert.equal(ev.additionalProperties, false)
  assert.ok(ev.required.includes('metrics'))
  const metric = ev.properties.metrics.items
  assert.deepEqual(metric.required, ['name', 'value'])
  assert.equal(metric.properties.value.type, 'number')
})

test('схема сводки принимает только ссылки на наблюдения', () => {
  const schema = briefTool().input_schema
  assert.deepEqual(schema.required.sort(), ['attentionIds', 'ok', 'summary', 'watchIds'])
  assert.equal(schema.properties.attentionIds.items.type, 'string')
  assert.equal(schema.additionalProperties, false)
  assert.ok(!('findings' in schema.properties), 'пересказывать наблюдения сводке нечем')
})
