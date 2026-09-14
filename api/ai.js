/**
 * Вызовы модели (архитектура AI, слой 4).
 *
 * Ключ провайдера есть только здесь. Клиент присылает идентификатор агента и
 * датасет, собранный слоем аналитики; подсказку и схему ответа подставляет
 * сервер по своему реестру.
 *
 * Без ключа модуль просто выключен: аналитика, дашборд и отчёты продолжают
 * работать — AI добавляет толкование поверх данных, а не заменяет их.
 */
import Anthropic from '@anthropic-ai/sdk'
import { AGENTS, EXECUTIVE_SYSTEM, agentSystem, briefTool, isAgent, reportTool } from './aiAgents.js'

const API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL = process.env.AI_MODEL || 'claude-opus-5'
/** Доменный агент разбирает узкую область — средних усилий достаточно. */
const AGENT_EFFORT = process.env.AI_AGENT_EFFORT || 'medium'
const MAX_TOKENS = 16000
/** Потолок датасета: 256 КБ хватает с запасом, дальше — попытка прогнать базу. */
const MAX_DATASET_BYTES = 256 * 1024

/**
 * Частота обращений. Полный брифинг — шесть вызовов модели, поэтому окно
 * рассчитано примерно на пять брифингов в десять минут на пользователя.
 * Счётчик в памяти процесса: API работает одним экземпляром.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = Number(process.env.AI_RATE_MAX || 30)
const hits = new Map()

/** Разрешить запрос. false — лимит исчерпан. */
export function allowRequest(key, now = Date.now()) {
  const stamps = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (stamps.length >= RATE_MAX) {
    hits.set(key, stamps)
    return false
  }
  stamps.push(now)
  hits.set(key, stamps)
  return true
}

let client = null
function getClient() {
  if (!client) client = new Anthropic({ apiKey: API_KEY })
  return client
}

/** Настроен ли AI. Ответ «нет» — штатное состояние. */
export function aiEnabled() {
  return API_KEY.length > 0
}

export function aiStatus() {
  if (!aiEnabled()) {
    return {
      enabled: false,
      reason: 'AI не настроен: в окружении нет ANTHROPIC_API_KEY. Аналитика работает без него.',
    }
  }
  return { enabled: true, model: MODEL }
}

/** Размер полезной нагрузки в байтах — чтобы не гонять через ключ что попало. */
export function datasetTooBig(dataset) {
  return Buffer.byteLength(JSON.stringify(dataset ?? null), 'utf8') > MAX_DATASET_BYTES
}

/** Достать аргументы единственного инструмента из ответа модели. */
function toolInput(message, toolName) {
  for (const block of message.content ?? []) {
    if (block.type === 'tool_use' && block.name === toolName) return block.input
  }
  return null
}

function describeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'ключ AI отклонён провайдером'
  if (e instanceof Anthropic.RateLimitError) return 'превышен лимит запросов к AI, попробуйте позже'
  if (e instanceof Anthropic.BadRequestError) return `запрос к AI отклонён: ${e.message}`
  if (e instanceof Anthropic.APIError) return `AI ответил ошибкой ${e.status}`
  return 'не удалось получить ответ AI'
}

/**
 * Запустить доменного агента на его датасете.
 * Возвращает отчёт в формате слоя AI; проверку evidence делает клиент — он
 * держит тот же индекс аналитики, на котором датасет и собирался.
 */
export async function runAgent(agentId, dataset) {
  if (!isAgent(agentId)) throw Object.assign(new Error('неизвестный агент'), { status: 400 })
  if (!aiEnabled()) throw Object.assign(new Error('AI не настроен'), { status: 503 })

  let message
  try {
    message = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: AGENT_EFFORT },
      system: agentSystem(agentId),
      messages: [
        {
          role: 'user',
          content: `Данные твоей области (посчитаны слоем аналитики):\n\n${JSON.stringify(dataset, null, 2)}\n\nРазбери их и верни наблюдения вызовом инструмента report.`,
        },
      ],
      tools: [reportTool()],
    })
  } catch (e) {
    throw Object.assign(new Error(describeError(e)), { status: 502 })
  }

  if (message.stop_reason === 'refusal') {
    throw Object.assign(new Error('модель отказалась отвечать на эти данные'), { status: 502 })
  }

  const input = toolInput(message, 'report')
  if (!input) {
    throw Object.assign(new Error('модель не вернула отчёт'), { status: 502 })
  }

  const at = new Date().toISOString()
  const findings = Array.isArray(input.findings) ? input.findings : []
  return {
    agent: agentId,
    at,
    // Идентификатор наблюдения назначает сервер: так он точно уникален и по
    // нему сводка сможет сослаться на наблюдение, ничего не переписывая.
    findings: findings.map((f, i) => ({ ...f, id: `${agentId}_${i + 1}`, agent: agentId })),
    insufficientData: typeof input.insufficientData === 'string' && input.insufficientData.trim()
      ? input.insufficientData.trim()
      : undefined,
  }
}

/**
 * Сводка руководителя. На вход — только проверенные наблюдения, без данных
 * CORE. В ответе — ссылки на наблюдения по id, а не их пересказ.
 */
export async function runExecutive(findings) {
  // Сначала проверяется сам запрос: неверный вход остаётся неверным и при
  // выключенном AI, и отвечать на него «сервис не настроен» — вводить в
  // заблуждение.
  if (!Array.isArray(findings) || findings.length === 0) {
    throw Object.assign(new Error('нет наблюдений для сводки'), { status: 400 })
  }
  if (!aiEnabled()) throw Object.assign(new Error('AI не настроен'), { status: 503 })

  // До модели доходит ровно столько, сколько нужно для приоритизации.
  const input = findings.map((f) => ({
    id: f.id,
    agent: f.agent,
    title: f.title,
    severity: f.severity,
    fact: f.fact,
    interpretation: f.interpretation,
    recommendation: f.recommendation,
  }))

  let message
  try {
    message = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: EXECUTIVE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Наблюдения доменных агентов (уже сверены с фактами):\n\n${JSON.stringify(input, null, 2)}\n\nСобери сводку вызовом инструмента brief.`,
        },
      ],
      tools: [briefTool()],
    })
  } catch (e) {
    throw Object.assign(new Error(describeError(e)), { status: 502 })
  }

  if (message.stop_reason === 'refusal') {
    throw Object.assign(new Error('модель отказалась собирать сводку'), { status: 502 })
  }

  const out = toolInput(message, 'brief')
  if (!out) throw Object.assign(new Error('модель не вернула сводку'), { status: 502 })

  return {
    at: new Date().toISOString(),
    summary: typeof out.summary === 'string' ? out.summary : '',
    attentionIds: Array.isArray(out.attentionIds) ? out.attentionIds.filter((x) => typeof x === 'string') : [],
    watchIds: Array.isArray(out.watchIds) ? out.watchIds.filter((x) => typeof x === 'string') : [],
    ok: Array.isArray(out.ok) ? out.ok.filter((x) => typeof x === 'string' && x.trim()) : [],
  }
}

export { AGENTS }
