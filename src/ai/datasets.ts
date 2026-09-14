/**
 * Датасеты доменных агентов (архитектура AI, слой 3).
 *
 * Агент не получает базу CORE. Он получает готовые числа своей области и
 * поимённый список задач, которых эти числа касаются. Размер выборки ограничен
 * и усечение показано явно (`total` / `omitted`): агент должен видеть, что
 * задач больше, чем прислали, и не делать вид, будто перечислил все.
 */
import {
  getCriticalTasks,
  getDataQualityIssues,
  getDeadlineBuckets,
  getOverdueTasks,
  getProjectHealthSignals,
  getProjectMetrics,
  getUnassignedTasks,
  getWipViolations,
  getWorkloadByDepartment,
  getWorkloadByEmployee,
  type AnalyticsIndex,
  type Scope,
  type TaskRef,
} from '@/analytics'
import type { AgentId, TaskSample } from './types'

/** Сколько задач максимум уходит в один список датасета. */
export const SAMPLE_LIMIT = 20

/** Усечь список задач, честно показав, сколько осталось за кадром. */
export function sample(tasks: TaskRef[], limit = SAMPLE_LIMIT): TaskSample {
  return {
    total: tasks.length,
    sample: tasks.slice(0, limit),
    omitted: Math.max(0, tasks.length - limit),
  }
}

/** Датасет агента команды: люди, загрузка, просрочки по людям. */
export function buildTeamDataset(ix: AnalyticsIndex, scope: Scope = {}) {
  const rows = getWorkloadByEmployee(ix, scope)
  return {
    at: ix.at,
    norm: 4,
    employees: rows.length,
    workload: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      department: r.department,
      active: r.active,
      overdue: r.overdue,
      workloadPct: r.workload,
    })),
    departments: getWorkloadByDepartment(ix, scope).map((d) => ({
      department: d.department,
      employees: d.employees,
      active: d.active,
      overdue: d.overdue,
      completionPct: d.completion,
      avgWorkloadPct: d.avgWorkload,
    })),
  }
}

/** Датасет агента проекта: метрики доски, состав списков, сигналы. */
export function buildProjectDataset(ix: AnalyticsIndex, boardId: string) {
  const m = getProjectMetrics(ix, boardId)
  const signals = getProjectHealthSignals(ix, boardId)
  if (!m || !signals) return null
  return {
    at: ix.at,
    boardId,
    name: m.name,
    totalTasks: m.counts.total,
    activeTasks: m.counts.active,
    completedTasks: m.counts.done,
    overdueTasks: m.counts.overdue,
    unassignedTasks: m.counts.unassigned,
    tasksWithoutDueDate: m.counts.noDueDate,
    completionPct: m.completion,
    members: m.members,
    byPriority: m.byPriority,
    lists: m.lists,
    signals: {
      overdueSharePct: signals.overdueShare,
      unassignedSharePct: signals.unassignedShare,
      noDueDateSharePct: signals.noDueDateShare,
      wipViolations: signals.wipViolations,
      daysSinceActivity: signals.daysSinceActivity,
    },
  }
}

/** Датасет агента сроков: окна по времени. */
export function buildDeadlineDataset(ix: AnalyticsIndex, scope: Scope = {}) {
  const b = getDeadlineBuckets(ix, scope)
  return {
    at: ix.at,
    note: 'Окна накопительные: задача из next24h входит и в next48h, и в next7days.',
    overdue: sample(b.overdue),
    today: sample(b.today),
    next24h: sample(b.next24h),
    next48h: sample(b.next48h),
    next7days: sample(b.next7days),
  }
}

/** Датасет агента рисков: критические задачи, WIP, просрочки. */
export function buildRiskDataset(ix: AnalyticsIndex, scope: Scope = {}) {
  return {
    at: ix.at,
    critical: sample(getCriticalTasks(ix, scope)),
    overdue: sample(getOverdueTasks(ix, scope)),
    wipViolations: getWipViolations(ix, scope),
    boards: ix.boards
      .filter((b) => !b.archived)
      .map((b) => {
        const s = getProjectHealthSignals(ix, b.id)
        return {
          boardId: b.id,
          name: b.name,
          active: s?.active ?? 0,
          overdueSharePct: s?.overdueShare ?? 0,
          completionPct: s?.completion ?? 0,
          daysSinceActivity: s?.daysSinceActivity ?? null,
        }
      }),
  }
}

/** Датасет агента качества данных: пробелы в заполнении. */
export function buildQualityDataset(ix: AnalyticsIndex, scope: Scope = {}) {
  const q = getDataQualityIssues(ix, scope)
  return {
    at: ix.at,
    unassigned: sample(q.unassigned),
    noDueDate: sample(q.noDueDate),
    overdueUnassigned: sample(q.overdueUnassigned),
    invalidDates: sample(q.invalidDates),
    unassignedAll: getUnassignedTasks(ix, scope).length,
  }
}

/** Датасет по идентификатору агента. null — области нет (например, нет такой доски). */
export function buildDataset(
  agent: AgentId,
  ix: AnalyticsIndex,
  scope: Scope = {},
): unknown | null {
  switch (agent) {
    case 'team':
      return buildTeamDataset(ix, scope)
    case 'project':
      return scope.boardId ? buildProjectDataset(ix, scope.boardId) : null
    case 'deadline':
      return buildDeadlineDataset(ix, scope)
    case 'risk':
      return buildRiskDataset(ix, scope)
    case 'quality':
      return buildQualityDataset(ix, scope)
  }
}
