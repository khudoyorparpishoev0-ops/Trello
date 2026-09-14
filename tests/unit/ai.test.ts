/**
 * Тесты AI-слоя (архитектура AI, слои 3–4).
 *
 * Проверяется не качество формулировок — его тестом не поймать, — а то, что
 * архитектура держит: агент получает выжимку, а не базу; выдуманное число не
 * проходит; несуществующая сущность не проходит; сводка не может завести
 * собственное наблюдение; отказ одного агента не рушит брифинг.
 */
process.env.TZ = 'UTC'

import test from 'node:test'
import assert from 'node:assert/strict'
import { analyze } from '../../src/analytics/index.ts'
import {
  SAMPLE_LIMIT,
  buildDataset,
  buildDatasets,
  buildDeadlineDataset,
  buildProjectDataset,
  buildTeamDataset,
  checkFinding,
  collectNumbers,
  resolveBriefIds,
  runBrief,
  verifyReport,
} from '../../src/ai/index.ts'
import type { AgentReport, Finding } from '../../src/ai/types.ts'
import { NOW, fixture } from './fixture.ts'

const ix = analyze(fixture(), NOW)
const scope = { boardId: 'b1' }

/** Наблюдение-образец: всё сходится с данными. */
function goodFinding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'team_1',
    agent: 'team',
    title: 'Перекос загрузки',
    severity: 'warning',
    fact: 'У Алисы 3 активные задачи, у Веры — 0.',
    interpretation: 'Работа распределена неравномерно.',
    recommendation: 'Рассмотреть передачу части задач.',
    evidence: {
      metrics: [{ name: 'активных у Алисы', value: 3 }],
      userIds: ['u1'],
      cardIds: [],
      boardIds: [],
      departments: [],
    },
    ...over,
  }
}

// ——— Датасеты ———

test('датасет: агент получает выжимку, а не базу CORE', () => {
  const ds = buildTeamDataset(ix) as Record<string, unknown>
  const text = JSON.stringify(ds)
  assert.ok(!text.includes('checklists'), 'в датасете не должно быть внутренностей карточек')
  assert.ok(!text.includes('comments'), 'комментарии агенту команды не нужны')
  assert.ok(text.length < 4000, 'датасет должен быть компактным')
  assert.equal((ds.workload as unknown[]).length, 3)
})

test('датасет: усечение списка показано честно', () => {
  const many = Array.from({ length: SAMPLE_LIMIT + 5 }, (_, i) => ({
    ...fixture().cards.c6,
    id: `x${i}`,
  }))
  const data = fixture()
  for (const c of many) data.cards[c.id] = c
  data.lists.l3.cardIds = many.map((c) => c.id)
  const big = analyze(data, NOW)
  const ds = buildDeadlineDataset(big) as { overdue: { total: number; sample: unknown[]; omitted: number } }
  assert.equal(ds.overdue.total, SAMPLE_LIMIT + 5 + 1)
  assert.equal(ds.overdue.sample.length, SAMPLE_LIMIT)
  assert.equal(ds.overdue.omitted, 6)
})

test('датасет проекта: несуществующая доска — null, а не пустышка', () => {
  assert.equal(buildProjectDataset(ix, 'нет-такой'), null)
  assert.equal(buildDataset('project', ix, {}), null, 'без доски агенту проекта нечего смотреть')
})

test('набор агентов: без доски агент проекта не запускается', () => {
  const withBoard = buildDatasets(ix, scope).map((d) => d.agent)
  const without = buildDatasets(ix, {}).map((d) => d.agent)
  assert.ok(withBoard.includes('project'))
  assert.ok(!without.includes('project'))
})

// ——— Сверка с фактами ———

test('числа датасета собираются на любой глубине', () => {
  const nums = collectNumbers({ a: 1, b: [2, { c: 3 }], d: 'нет' })
  assert.deepEqual([...nums].sort((x, y) => x - y), [1, 2, 3])
})

test('верное наблюдение проходит проверку', () => {
  const ds = buildTeamDataset(ix)
  assert.equal(
    checkFinding(goodFinding(), { agent: 'team', ix, datasetNumbers: collectNumbers(ds) }),
    null,
  )
})

test('выдуманное число не проходит: агент не считает сам', () => {
  const ds = buildTeamDataset(ix)
  // 87 в датасете нет — такое число агент мог только вычислить или придумать.
  const bad = goodFinding({
    evidence: { metrics: [{ name: 'загрузка', value: 87 }], userIds: ['u1'] },
  })
  const reason = checkFinding(bad, { agent: 'team', ix, datasetNumbers: collectNumbers(ds) })
  assert.match(String(reason), /отсутствует в данных/)
})

test('несуществующая задача не проходит', () => {
  const bad = goodFinding({
    evidence: { metrics: [], cardIds: ['card_выдумка'] },
  })
  const reason = checkFinding(bad, { agent: 'team', ix, datasetNumbers: new Set<number>() })
  assert.match(String(reason), /не существует/)
})

test('несуществующий сотрудник и отдел не проходят', () => {
  const nums = new Set<number>()
  assert.match(
    String(checkFinding(goodFinding({ evidence: { metrics: [], userIds: ['u99'] } }), { agent: 'team', ix, datasetNumbers: nums })),
    /сотрудника u99 не существует/,
  )
  assert.match(
    String(checkFinding(goodFinding({ evidence: { metrics: [], departments: ['Маркетинг'] } }), { agent: 'team', ix, datasetNumbers: nums })),
    /отдела «Маркетинг» не существует/,
  )
})

test('задача вне области запроса не проходит', () => {
  // c5 лежит на доске b2, а спрашивали про b1.
  const bad = goodFinding({ evidence: { metrics: [], cardIds: ['c5'] } })
  const reason = checkFinding(bad, { agent: 'team', ix, datasetNumbers: new Set<number>(), scope })
  assert.match(String(reason), /вне области запроса/)
})

test('наблюдение без доказательства не проходит', () => {
  const bad = goodFinding({ evidence: { metrics: [] } })
  const reason = checkFinding(bad, { agent: 'team', ix, datasetNumbers: new Set<number>() })
  assert.match(String(reason), /без доказательства/)
})

test('пустые поля и чужая подпись не проходят', () => {
  const nums = collectNumbers(buildTeamDataset(ix))
  const opts = { agent: 'team' as const, ix, datasetNumbers: nums }
  assert.match(String(checkFinding(goodFinding({ fact: '  ' }), opts)), /пустая фактическая часть/)
  assert.match(String(checkFinding(goodFinding({ recommendation: '' }), opts)), /нет рекомендации/)
  assert.match(
    String(checkFinding(goodFinding({ severity: 'страшно' as never }), opts)),
    /неизвестная важность/,
  )
  assert.match(String(checkFinding(goodFinding({ agent: 'risk' }), opts)), /чужим агентом/)
})

test('отчёт делится на принятое и отклонённое', () => {
  const ds = buildTeamDataset(ix)
  const report: AgentReport = {
    agent: 'team',
    at: NOW.toISOString(),
    findings: [
      goodFinding(),
      goodFinding({ id: 'team_2', evidence: { metrics: [{ name: 'выдумка', value: 987 }] } }),
    ],
  }
  const verified = verifyReport(report, { ix, dataset: ds })
  assert.equal(verified.accepted.length, 1)
  assert.equal(verified.rejected.length, 1)
  assert.equal(verified.rejected[0].finding.id, 'team_2')
})

// ——— Сводка ———

test('сводка не может сослаться на несуществующее наблюдение', () => {
  const allowed = [goodFinding()]
  assert.deepEqual(resolveBriefIds(['team_1', 'придумано', 'team_1'], allowed), allowed)
})

// ——— Конвейер ———

test('конвейер: выдуманные выводы не доходят до сводки', async () => {
  const seen: string[] = []
  const result = await runBrief(ix, scope, {
    callAgent: async (agent, dataset) => {
      seen.push(agent)
      // Честное наблюдение берёт число из датасета этого же агента,
      // выдуманное — число, которого там нет.
      const real = [...collectNumbers(dataset)][0] ?? 0
      return {
        agent,
        at: NOW.toISOString(),
        findings: [
          {
            ...goodFinding(),
            id: `${agent}_1`,
            agent,
            evidence: { metrics: [{ name: 'из данных', value: real }], userIds: ['u1'] },
          },
          {
            ...goodFinding(),
            id: `${agent}_2`,
            agent,
            evidence: { metrics: [{ name: 'выдумка', value: 123456 }] },
          },
        ],
      }
    },
    callExecutive: async (findings) => ({
      at: NOW.toISOString(),
      summary: 'Сводка',
      attentionIds: [...findings.map((f) => f.id), 'несуществующее'],
      watchIds: [],
      ok: ['Просрочек в срочных задачах нет'],
    }),
  })

  assert.ok(seen.length >= 4, 'должны отработать все доменные агенты области')
  assert.equal(result.rejectedCount, seen.length, 'по одному выдуманному выводу на агента')
  assert.equal(
    result.brief.attention.length,
    seen.length,
    'в сводку попадают только проверенные наблюдения',
  )
  assert.ok(
    result.brief.attention.every((f) => f.id.endsWith('_1')),
    'выдуманное наблюдение не должно доходить до руководителя',
  )
})

test('конвейер: отказ агента не рушит брифинг', async () => {
  const result = await runBrief(ix, scope, {
    callAgent: async (agent) => {
      if (agent === 'team') throw new Error('провайдер недоступен')
      return { agent, at: NOW.toISOString(), findings: [{ ...goodFinding(), id: `${agent}_1`, agent }] }
    },
    callExecutive: async (findings) => ({
      at: NOW.toISOString(),
      summary: 'Сводка',
      attentionIds: findings.map((f) => f.id),
      watchIds: [],
      ok: [],
    }),
  })
  const team = result.reports.find((r) => r.agent === 'team')
  assert.equal(team?.accepted.length, 0)
  assert.match(String(team?.insufficientData), /провайдер недоступен/)
  assert.ok(result.brief.attention.length > 0, 'остальные агенты продолжают работать')
})

test('конвейер: без наблюдений сводка объясняет молчание', async () => {
  const result = await runBrief(ix, scope, {
    callAgent: async (agent) => ({
      agent,
      at: NOW.toISOString(),
      findings: [],
      insufficientData: 'Данных для оценки недостаточно.',
    }),
    callExecutive: async () => {
      throw new Error('сводку звать не должны')
    },
  })
  assert.equal(result.brief.attention.length, 0)
  assert.match(result.brief.summary, /Недостаточно|Наблюдений нет/)
})

test('конвейер: сбой сводки не теряет проверенные наблюдения', async () => {
  const result = await runBrief(ix, scope, {
    callAgent: async (agent) => ({
      agent,
      at: NOW.toISOString(),
      findings: [{ ...goodFinding(), id: `${agent}_1`, agent, severity: 'critical' }],
    }),
    callExecutive: async () => {
      throw new Error('AI ответил ошибкой')
    },
  })
  assert.ok(result.brief.attention.length > 0)
  assert.match(result.brief.summary, /Сводка не собрана/)
})
