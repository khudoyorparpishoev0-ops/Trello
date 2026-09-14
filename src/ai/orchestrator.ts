/**
 * Оркестратор (архитектура AI, пункт 7).
 *
 * Порядок жёсткий и другим быть не может:
 *   аналитика → датасеты → доменные агенты → проверка → Executive Agent.
 *
 * Executive Agent не видит ни доску, ни карточки — только проверенные выводы
 * доменных агентов. Всё, что не прошло сверку с фактами, до него не доходит.
 */
import type { AnalyticsIndex, Scope } from '@/analytics'
import { buildDatasets } from './agents'
import { runAgent, runExecutive } from './client'
import { resolveBriefIds, verifyReport } from './verify'
import type { BriefResult, ExecutiveBrief, Finding, VerifiedReport } from './types'

/** Сколько выводов одного агента доходит до сводки. */
export const MAX_FINDINGS_PER_AGENT = 6

export interface RunOptions {
  /** Подменяется в тестах; по умолчанию — реальные вызовы сервера. */
  callAgent?: typeof runAgent
  callExecutive?: typeof runExecutive
  /** Сообщать о ходе работы — интерфейс показывает, какой агент сейчас думает. */
  onProgress?: (stage: string) => void
}

/**
 * Прогнать конвейер целиком.
 * Агент, который не ответил, не валит весь брифинг: его область просто
 * останется без наблюдений, и это будет видно.
 */
export async function runBrief(
  ix: AnalyticsIndex,
  scope: Scope = {},
  options: RunOptions = {},
): Promise<BriefResult> {
  const callAgent = options.callAgent ?? runAgent
  const callExecutive = options.callExecutive ?? runExecutive
  const progress = options.onProgress ?? (() => {})

  const datasets = buildDatasets(ix, scope)

  progress('Доменные агенты разбирают свои области')
  const reports: VerifiedReport[] = await Promise.all(
    datasets.map(async ({ agent, dataset }) => {
      try {
        const raw = await callAgent(agent, dataset)
        const verified = verifyReport(raw, { ix, dataset, scope })
        return {
          ...verified,
          accepted: verified.accepted.slice(0, MAX_FINDINGS_PER_AGENT),
        }
      } catch (e) {
        return {
          agent,
          at: ix.at,
          accepted: [],
          rejected: [],
          insufficientData: `Агент не ответил: ${e instanceof Error ? e.message : 'ошибка'}`,
        }
      }
    }),
  )

  const accepted: Finding[] = reports.flatMap((r) => r.accepted)
  const rejectedCount = reports.reduce((s, r) => s + r.rejected.length, 0)

  if (accepted.length === 0) {
    return {
      at: ix.at,
      brief: emptyBrief(ix.at, reports),
      reports,
      rejectedCount,
    }
  }

  progress('Сводка руководителя')
  let brief: ExecutiveBrief
  try {
    const raw = await callExecutive(accepted)
    brief = {
      at: raw.at || ix.at,
      summary: raw.summary ?? '',
      // Сводка ссылается на наблюдения по id — здесь ссылки разворачиваются в
      // исходные объекты вместе с их доказательствами.
      attention: resolveBriefIds(raw.attentionIds, accepted),
      watch: resolveBriefIds(raw.watchIds, accepted),
      ok: (raw.ok ?? []).filter((t) => typeof t === 'string' && t.trim()),
    }
  } catch {
    // Без сводки брифинг всё равно полезен: наблюдения уже проверены.
    brief = {
      at: ix.at,
      summary: 'Сводка не собрана — сервис ответил ошибкой. Наблюдения агентов ниже проверены.',
      attention: accepted.filter((f) => f.severity === 'critical'),
      watch: accepted.filter((f) => f.severity !== 'critical'),
      ok: [],
    }
  }

  return { at: ix.at, brief, reports, rejectedCount }
}

/** Сводка, когда наблюдений нет. Молчание тоже нужно объяснить. */
function emptyBrief(at: string, reports: VerifiedReport[]): ExecutiveBrief {
  const excuses = reports.map((r) => r.insufficientData).filter(Boolean) as string[]
  return {
    at,
    summary: excuses.length
      ? `Наблюдений нет. ${excuses.join(' ')}`
      : 'Агенты не нашли того, что требует внимания.',
    attention: [],
    watch: [],
    ok: [],
  }
}
