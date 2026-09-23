/**
 * Слой аналитики CORE — единственный источник цифр (архитектура AI, слой 2).
 *
 * Правило системы: CORE хранит факты, аналитика считает, агенты
 * интерпретируют. Любой показатель — количество задач, проценты, загрузка,
 * просрочки, WIP — рассчитывается здесь и только здесь. Экраны и агенты
 * читают готовое; второй копии расчёта не существует.
 *
 * Слой не зависит от AI: он работает при отключённом провайдере, без ключа и
 * при недоступном сервисе. Дашборд, «Команда» и «Отчёты» построены на нём.
 */
export * from './types.js'
export { analyze, WORKLOAD_NORM, workloadPct, pct, select, activeOf } from './analyze.js'
export {
  countTasks,
  countByPriority,
  getTaskMetrics,
  getCompanyMetrics,
  getProjectMetrics,
  getEmployeeMetrics,
  getDepartmentMetrics,
  getProjectCompletion,
  activeIn,
} from './metrics.js'
export {
  getOverdueTasks,
  getUpcomingDeadlines,
  getDeadlineBuckets,
  getUnassignedTasks,
  getTasksWithoutDueDate,
  getCriticalTasks,
  getWipViolations,
  getDataQualityIssues,
  getDeadlineQueue,
  getRecentActivity,
} from './queries.js'
export { getWorkloadByEmployee, getWorkloadByDepartment } from './workload.js'
export { getProjectHealthSignals } from './health.js'
