/**
 * Сигналы проекта (архитектура AI, слой 2).
 *
 * Здесь только доли и количества. Слов «риск», «плохо», «требует внимания» в
 * этом файле нет и быть не должно: пороги и оценка — работа агента, иначе
 * суждение окажется зашитым в код и его нельзя будет ни объяснить, ни изменить.
 */
import type { AnalyticsIndex, ProjectHealthSignals } from './types.js'
import { pct } from './analyze.js'
import { getProjectMetrics } from './metrics.js'
import { getWipViolations } from './queries.js'

const DAY = 24 * 60 * 60 * 1000

/** Последнее событие на доске: создание карточки или сообщение в задаче. */
function lastActivityAt(ix: AnalyticsIndex, boardId: string): number | null {
  let last: number | null = null
  for (const f of ix.byBoard[boardId] ?? []) {
    const stamps = [f.card.createdAt, ...f.card.comments.map((c) => c.createdAt)]
    for (const iso of stamps) {
      const t = new Date(iso).getTime()
      if (!Number.isFinite(t)) continue
      if (last === null || t > last) last = t
    }
  }
  return last
}

/** Числовые сигналы проекта. Нет такой доски — null. */
export function getProjectHealthSignals(
  ix: AnalyticsIndex,
  boardId: string,
): ProjectHealthSignals | null {
  const m = getProjectMetrics(ix, boardId)
  if (!m) return null

  const last = lastActivityAt(ix, boardId)
  const now = new Date(ix.at).getTime()

  return {
    at: ix.at,
    boardId,
    name: m.name,
    completion: m.completion,
    overdueShare: pct(m.counts.overdue, m.counts.active),
    unassignedShare: pct(m.counts.unassigned, m.counts.active),
    noDueDateShare: pct(m.counts.noDueDate, m.counts.active),
    wipViolations: getWipViolations(ix, { boardId }).length,
    active: m.counts.active,
    daysSinceActivity: last === null ? null : Math.floor((now - last) / DAY),
  }
}
