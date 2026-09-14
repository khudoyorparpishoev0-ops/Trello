/**
 * Загрузка людей и отделов (архитектура AI, слой 2).
 * Норма — одна на систему, `WORKLOAD_NORM`; здесь только её применение.
 */
import type {
  AnalyticsIndex,
  DepartmentWorkloadRow,
  Scope,
  WorkloadRow,
} from './types'
import { departmentOf, pct, select, workloadPct } from './analyze'

/**
 * Загрузка по сотрудникам, самые нагруженные первыми.
 * В список попадают все известные сотрудники, включая тех, у кого нет задач:
 * ноль задач — это тоже факт, и именно он показывает перекос.
 */
export function getWorkloadByEmployee(ix: AnalyticsIndex, scope: Scope = {}): WorkloadRow[] {
  return Object.values(ix.users)
    .map((u) => {
      const mine = (ix.byAssignee[u.id] ?? []).filter(
        (f) => !f.done && (scope.boardId ? f.boardId === scope.boardId : !f.archived),
      )
      const overdue = mine.filter((f) => f.overdue).length
      return {
        userId: u.id,
        name: u.name,
        department: departmentOf(u),
        active: mine.length,
        overdue,
        workload: workloadPct(mine.length),
      }
    })
    .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'ru'))
}

/**
 * Загрузка по отделам. Задача засчитывается отделу один раз, даже если в ней
 * несколько исполнителей оттуда — иначе одна задача с тремя исполнителями
 * выглядела бы как три.
 *
 * Отдел без людей и задач остаётся в списке с нулями: это честнее, чем
 * прятать его или подставлять придуманный план.
 */
export function getWorkloadByDepartment(
  ix: AnalyticsIndex,
  scope: Scope = {},
): DepartmentWorkloadRow[] {
  const rows = getWorkloadByEmployee(ix, scope)

  return ix.departments.map((department) => {
    const members = rows.filter((r) => r.department === department)
    const memberIds = new Set(members.map((m) => m.userId))

    let total = 0
    let done = 0
    let active = 0
    let overdue = 0
    const seen = new Set<string>()
    for (const f of select(ix, scope)) {
      if (seen.has(f.card.id)) continue
      if (!f.card.assigneeIds.some((id) => memberIds.has(id))) continue
      seen.add(f.card.id)
      total += 1
      if (f.done) {
        done += 1
        continue
      }
      active += 1
      if (f.overdue) overdue += 1
    }

    const avgWorkload = members.length
      ? Math.round(members.reduce((s, m) => s + m.workload, 0) / members.length)
      : 0

    return {
      department,
      employees: members.length,
      userIds: members.map((m) => m.userId),
      total,
      done,
      active,
      overdue,
      completion: pct(done, total),
      avgWorkload,
    }
  })
}
