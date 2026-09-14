/**
 * Критическая проверка общего кода: фронтенд и сервер считают одно и то же.
 *
 * Слева — исходники на TypeScript, которые импортирует интерфейс.
 * Справа — результат их компиляции, который выполняет API (`npm run
 * build:shared`). Если числа разойдутся, значит в системе снова два источника
 * расчётов — ровно та болезнь, от которой избавлялись.
 *
 * Тест заодно проверяет саму сборку: собранный артефакт обязан вести себя как
 * исходник, иначе сервер будет считать по вчерашнему коду.
 */
process.env.TZ = 'UTC'

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Путь интерфейса: `@/analytics` — это переэкспорт общего кода.
import * as frontend from '../../src/analytics/index.ts'
// Путь сервера: скомпилированный ESM, который лежит рядом с server.js.
import * as server from '../../api/shared/analytics/index.js'
import { NOW, fixture } from '../unit/fixture.ts'

const data = fixture()

test('норма загрузки объявлена один раз и совпадает', () => {
  assert.equal(frontend.WORKLOAD_NORM, server.WORKLOAD_NORM)
  assert.equal(frontend.WORKLOAD_NORM, 4)
})

test('метрики компании совпадают до последнего числа', () => {
  const a = frontend.getCompanyMetrics(frontend.analyze(data, NOW))
  const b = server.getCompanyMetrics(server.analyze(data, NOW))
  assert.deepEqual(a, b)
})

test('метрики проекта, отдела и сотрудника совпадают', () => {
  const ixA = frontend.analyze(data, NOW)
  const ixB = server.analyze(data, NOW)
  assert.deepEqual(frontend.getProjectMetrics(ixA, 'b1'), server.getProjectMetrics(ixB, 'b1'))
  assert.deepEqual(
    frontend.getDepartmentMetrics(ixA, 'Разработка'),
    server.getDepartmentMetrics(ixB, 'Разработка'),
  )
  assert.deepEqual(frontend.getEmployeeMetrics(ixA, 'u1'), server.getEmployeeMetrics(ixB, 'u1'))
})

test('выборки задач и загрузка совпадают', () => {
  const ixA = frontend.analyze(data, NOW)
  const ixB = server.analyze(data, NOW)
  assert.deepEqual(frontend.getOverdueTasks(ixA), server.getOverdueTasks(ixB))
  assert.deepEqual(frontend.getUpcomingDeadlines(ixA), server.getUpcomingDeadlines(ixB))
  assert.deepEqual(frontend.getDeadlineBuckets(ixA), server.getDeadlineBuckets(ixB))
  assert.deepEqual(frontend.getWorkloadByEmployee(ixA), server.getWorkloadByEmployee(ixB))
  assert.deepEqual(frontend.getWorkloadByDepartment(ixA), server.getWorkloadByDepartment(ixB))
  assert.deepEqual(frontend.getWipViolations(ixA), server.getWipViolations(ixB))
  assert.deepEqual(frontend.getDataQualityIssues(ixA), server.getDataQualityIssues(ixB))
  assert.deepEqual(frontend.getProjectHealthSignals(ixA, 'b1'), server.getProjectHealthSignals(ixB, 'b1'))
})

test('обе стороны экспортируют одинаковый набор функций', () => {
  const names = (m: object) => Object.keys(m).sort()
  assert.deepEqual(names(frontend), names(server))
})

// ——— Защита от возврата второго источника расчётов ———

/** Все файлы с кодом, кроме общего слоя и сборки. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'shared') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path)
  }
  return out
}

test('норма загрузки нигде не объявлена второй раз', () => {
  const offenders: string[] = []
  for (const file of [...sourceFiles('src'), ...sourceFiles('api')]) {
    const text = readFileSync(file, 'utf8')
    // Ищем объявление своей константы нормы, а не использование общей.
    if (/\b(const|let|var)\s+\w*NORM\w*\s*=/.test(text)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'норма загрузки должна быть только в общем коде')
})

test('правила «выполнено» и «просрочено» нигде не переписаны заново', () => {
  const offenders: string[] = []
  for (const file of [...sourceFiles('src'), ...sourceFiles('api')]) {
    const text = readFileSync(file, 'utf8')
    if (/function\s+(isListDone|isDoneList|dueStatus)\s*\(/.test(text)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'правила должны жить только в общем коде')
})
