/**
 * Контракты AI-слоя CORE (архитектура AI, слои 3–4).
 *
 * Разделение ответственности зафиксировано в типах, а не только на словах:
 *  - `fact` — берётся из датасета аналитики, проверяется программно;
 *  - `interpretation` — мнение агента, его нельзя выдавать за факт;
 *  - `evidence` — числа и сущности, на которых вывод держится.
 *
 * Вывод без доказательства невалиден и до интерфейса не доходит.
 */
import type { TaskRef } from '@/analytics'

/** Доменные агенты. Каждый видит только свой датасет. */
export type AgentId = 'team' | 'project' | 'deadline' | 'risk' | 'quality'

/** Важность наблюдения. Ставит агент — это интерпретация, не факт. */
export type Severity = 'info' | 'warning' | 'critical'

/** Одно число доказательства: как называется и чему равно. */
export interface EvidenceMetric {
  name: string
  value: number
}

/**
 * Доказательная часть вывода.
 * `metrics` — числа, которые агент обязан взять из полученного датасета;
 * любое число, которого в датасете не было, считается выдуманным.
 */
export interface Evidence {
  metrics: EvidenceMetric[]
  cardIds?: string[]
  userIds?: string[]
  boardIds?: string[]
  departments?: string[]
}

/** Одно наблюдение агента. */
export interface Finding {
  id: string
  agent: AgentId
  title: string
  severity: Severity
  /** Только то, что есть в датасете. Проверяется сверкой evidence. */
  fact: string
  /** Толкование факта. Отделено от факта намеренно — интерфейс их не смешивает. */
  interpretation: string
  /** Что предлагается сделать. Решение принимает руководитель. */
  recommendation: string
  evidence: Evidence
}

/** Ответ одного доменного агента. */
export interface AgentReport {
  agent: AgentId
  at: string
  findings: Finding[]
  /**
   * Если данных не хватило — агент обязан сказать об этом, а не строить
   * предположения. Пустой отчёт с этим полем — нормальный результат.
   */
  insufficientData?: string
}

/** Отклонённый вывод: что именно не сошлось. */
export interface RejectedFinding {
  finding: Finding
  reason: string
}

/** Итог проверки отчёта агента. */
export interface VerifiedReport {
  agent: AgentId
  at: string
  accepted: Finding[]
  rejected: RejectedFinding[]
  insufficientData?: string
}

/**
 * Ответ Executive Agent по проводам: только ссылки на наблюдения.
 * Пересказывать чужие выводы ему нельзя — иначе доказательство изменится по
 * дороге, и проверять будет уже нечего.
 */
export interface ExecutivePicks {
  at: string
  summary: string
  attentionIds: string[]
  watchIds: string[]
  ok: string[]
}

/** Сводка руководителя: приоритизация чужих выводов, без новых фактов. */
export interface ExecutiveBrief {
  at: string
  /** Управленческая картина в двух-трёх предложениях. */
  summary: string
  /** Требует внимания — по убыванию важности. */
  attention: Finding[]
  /** Под наблюдением. */
  watch: Finding[]
  /** Что в порядке — короткие факты, без похвалы. */
  ok: string[]
}

/** Полный результат прогона конвейера. */
export interface BriefResult {
  at: string
  brief: ExecutiveBrief
  reports: VerifiedReport[]
  /** Сколько выводов отброшено проверкой. Показывается честно. */
  rejectedCount: number
}

/** Усечённый список задач: сколько всего и что отправлено агенту. */
export interface TaskSample {
  total: number
  sample: TaskRef[]
  /** Сколько задач не попало в выборку. */
  omitted: number
}
