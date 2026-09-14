/**
 * Сверка выводов агента с фактами (архитектура AI, пункты 11 и 12).
 *
 * Правило «AI запрещено утверждать факт, которого нет в датасете» здесь
 * превращается из пожелания в проверку. Любое число из доказательной части
 * обязано встречаться в датасете, который агент получил; любая сущность —
 * существовать в CORE и попадать в область запроса. Не сошлось — вывод
 * отбрасывается и не доходит ни до сводки, ни до экрана.
 *
 * Это единственный способ не проверять за агентом вручную: арифметику он не
 * делает, а значит и расходиться с аналитикой ему не на чем.
 */
import type { AnalyticsIndex, Scope } from '@/analytics'
import type {
  AgentId,
  AgentReport,
  Finding,
  RejectedFinding,
  Severity,
  VerifiedReport,
} from './types'

const SEVERITIES: Severity[] = ['info', 'warning', 'critical']

/** Все числа, встречающиеся в датасете, на любой глубине. */
export function collectNumbers(value: unknown, out = new Set<number>()): Set<number> {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) out.add(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbers(item, out)
  }
  return out
}

function nonEmpty(text: unknown): boolean {
  return typeof text === 'string' && text.trim().length > 0
}

/**
 * Проверить одно наблюдение. Возвращает причину отказа или null, если всё
 * сошлось. Причина формулируется по-человечески — её видно в интерфейсе.
 */
export function checkFinding(
  finding: Finding,
  opts: { agent: AgentId; ix: AnalyticsIndex; datasetNumbers: Set<number>; scope?: Scope },
): string | null {
  const { agent, ix, datasetNumbers, scope = {} } = opts

  if (finding.agent !== agent) return `вывод подписан чужим агентом («${finding.agent}»)`
  if (!nonEmpty(finding.title)) return 'пустой заголовок'
  if (!nonEmpty(finding.fact)) return 'пустая фактическая часть'
  if (!nonEmpty(finding.interpretation)) return 'пустая интерпретация'
  if (!nonEmpty(finding.recommendation)) return 'нет рекомендации'
  if (!SEVERITIES.includes(finding.severity)) return `неизвестная важность «${finding.severity}»`

  const ev = finding.evidence
  if (!ev || typeof ev !== 'object') return 'вывод без доказательства'

  const metrics = Array.isArray(ev.metrics) ? ev.metrics : []
  const entityCount =
    (ev.cardIds?.length ?? 0) +
    (ev.userIds?.length ?? 0) +
    (ev.boardIds?.length ?? 0) +
    (ev.departments?.length ?? 0)
  if (metrics.length === 0 && entityCount === 0) {
    return 'вывод без доказательства: ни метрик, ни сущностей'
  }

  // Числа: только те, что действительно были в датасете.
  for (const metric of metrics) {
    if (!nonEmpty(metric?.name)) return 'у метрики нет названия'
    if (typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
      return `метрика «${metric?.name}» не число`
    }
    if (!datasetNumbers.has(metric.value)) {
      return `число ${metric.value} («${metric.name}») отсутствует в данных — агент не считает сам`
    }
  }

  // Сущности: существуют и лежат в области запроса.
  for (const cardId of ev.cardIds ?? []) {
    const card = ix.byId[cardId]
    if (!card) return `задачи ${cardId} не существует`
    if (scope.boardId && card.boardId !== scope.boardId) {
      return `задача ${cardId} вне области запроса`
    }
    if (!scope.boardId && card.archived) return `задача ${cardId} на архивной доске`
  }
  for (const userId of ev.userIds ?? []) {
    if (!ix.users[userId]) return `сотрудника ${userId} не существует`
  }
  for (const boardId of ev.boardIds ?? []) {
    if (!ix.boards.some((b) => b.id === boardId)) return `проекта ${boardId} не существует`
  }
  for (const department of ev.departments ?? []) {
    if (!ix.departments.includes(department)) return `отдела «${department}» не существует`
  }

  return null
}

/** Проверить отчёт целиком. Принятые и отклонённые выводы разделяются. */
export function verifyReport(
  report: AgentReport,
  opts: { ix: AnalyticsIndex; dataset: unknown; scope?: Scope },
): VerifiedReport {
  const datasetNumbers = collectNumbers(opts.dataset)
  const accepted: Finding[] = []
  const rejected: RejectedFinding[] = []

  for (const finding of report.findings ?? []) {
    const reason = checkFinding(finding, {
      agent: report.agent,
      ix: opts.ix,
      datasetNumbers,
      scope: opts.scope,
    })
    if (reason) rejected.push({ finding, reason })
    else accepted.push(finding)
  }

  return {
    agent: report.agent,
    at: report.at || opts.ix.at,
    accepted,
    rejected,
    insufficientData: report.insufficientData,
  }
}

/**
 * Развернуть ссылки сводки в наблюдения. Executive Agent не имеет права
 * заводить новые выводы: он присылает только идентификаторы, и берётся
 * исходное наблюдение — с исходным доказательством. Неизвестный id и повтор
 * молча отбрасываются.
 */
export function resolveBriefIds(ids: string[], allowed: Finding[]): Finding[] {
  const byId = new Map(allowed.map((f) => [f.id, f]))
  const out: Finding[] = []
  const seen = new Set<string>()
  for (const id of ids ?? []) {
    const original = byId.get(id)
    if (!original || seen.has(id)) continue
    seen.add(id)
    out.push(original)
  }
  return out
}
