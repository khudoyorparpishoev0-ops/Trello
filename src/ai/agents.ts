/**
 * Реестр доменных агентов — клиентская половина (архитектура AI, слой 3).
 *
 * Здесь только то, что можно показать пользователю и чем собирается датасет.
 * Системные подсказки агентов живут на сервере (`api/aiAgents.js`) и оттуда не
 * уезжают: иначе браузер мог бы прислать любой текст и превратить наш ключ в
 * чужой чат. Клиент отправляет лишь «какой агент» и «его датасет».
 */
import type { AnalyticsIndex, Scope } from '@/analytics'
import { buildDataset } from './datasets'
import type { AgentId } from './types'

export interface AgentInfo {
  id: AgentId
  title: string
  /** Что этот агент смотрит — короткой строкой, для интерфейса. */
  looksAt: string
}

export const AGENTS: AgentInfo[] = [
  { id: 'deadline', title: 'Сроки', looksAt: 'просрочки и ближайшие дедлайны' },
  { id: 'team', title: 'Команда', looksAt: 'загрузка людей и отделов' },
  { id: 'project', title: 'Проект', looksAt: 'состояние открытой доски' },
  { id: 'risk', title: 'Риски', looksAt: 'критические задачи, WIP, застой' },
  { id: 'quality', title: 'Качество данных', looksAt: 'задачи без срока и исполнителя' },
]

export function agentInfo(id: AgentId): AgentInfo {
  return AGENTS.find((a) => a.id === id) ?? { id, title: id, looksAt: '' }
}

/**
 * Какие агенты имеет смысл запускать для этой области.
 * Агент проекта без выбранной доски не запускается: ему нечего смотреть.
 */
export function agentsForScope(scope: Scope): AgentId[] {
  return AGENTS.map((a) => a.id).filter((id) => id !== 'project' || Boolean(scope.boardId))
}

/** Датасеты всех подходящих агентов. Пустые области отсеиваются. */
export function buildDatasets(
  ix: AnalyticsIndex,
  scope: Scope,
): { agent: AgentId; dataset: unknown }[] {
  const out: { agent: AgentId; dataset: unknown }[] = []
  for (const agent of agentsForScope(scope)) {
    const dataset = buildDataset(agent, ix, scope)
    if (dataset) out.push({ agent, dataset })
  }
  return out
}
