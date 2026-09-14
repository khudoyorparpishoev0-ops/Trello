/**
 * AI-слой CORE (архитектура AI, слои 3–4).
 *
 * Слой надстроен над аналитикой и ничего не считает сам. Он:
 *  - собирает датасеты областей (`datasets`);
 *  - запускает доменных агентов через сервер (`client`);
 *  - сверяет их выводы с фактами и отбрасывает выдуманные (`verify`);
 *  - собирает управленческую сводку из проверенного (`orchestrator`).
 *
 * При выключенном AI слой просто не используется — аналитика и все экраны
 * работают как обычно.
 */
export * from './types'
export { AGENTS, agentInfo, agentsForScope, buildDatasets } from './agents'
export {
  SAMPLE_LIMIT,
  buildDataset,
  buildDeadlineDataset,
  buildProjectDataset,
  buildQualityDataset,
  buildRiskDataset,
  buildTeamDataset,
  sample,
} from './datasets'
export { fetchAiStatus, runAgent, runExecutive, type AiStatus } from './client'
export { checkFinding, collectNumbers, resolveBriefIds, verifyReport } from './verify'
export { MAX_FINDINGS_PER_AGENT, runBrief, type RunOptions } from './orchestrator'
