import type { Db } from '@hona/db'
import type { Logger } from '../logger.js'
import { CLAIM_BATCH_SIZE, claimBatch } from './claim.js'
import { dispatchBatch, type DispatchResult } from './dispatch.js'
import { sweep } from './sweeper.js'
import type { HandlerRegistry } from './types.js'

/** Страховочный опрос, если NOTIFY потерялся (§10.5: «раз в секунду»). */
export const POLL_INTERVAL_MS = 1_000
export const SWEEP_INTERVAL_MS = 60_000
/** Потолок паузы при недоступной базе: цикл не превращается в горячую петлю. */
export const MAX_ERROR_BACKOFF_MS = 30_000

export interface OutboxWorkerOptions {
  readonly db: Db
  readonly workerId: string
  readonly handlers: HandlerRegistry
  readonly log: Logger
  readonly batchSize?: number
  readonly pollIntervalMs?: number
  readonly sweepIntervalMs?: number
  readonly random?: () => number
  readonly handlerTimeoutMs?: number
}

export interface OutboxWorker {
  /** Один цикл: захват пачки и доставка. Возвращает результаты по строкам. */
  runOnce(): Promise<DispatchResult[]>
  start(): void
  /** Остановка: текущая пачка дорабатывается, новые не захватываются. */
  stop(): Promise<void>
  /** Разбудить цикл (LISTEN outbox_new). */
  wake(): void
  /** Время последнего успешного цикла (для health). */
  lastCycleAt(): number | null
}

export function createOutboxWorker(options: OutboxWorkerOptions): OutboxWorker {
  const batchSize = options.batchSize ?? CLAIM_BATCH_SIZE
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS
  const dispatchDeps = {
    db: options.db,
    workerId: options.workerId,
    handlers: options.handlers,
    log: options.log,
    ...(options.random ? { random: options.random } : {}),
    ...(options.handlerTimeoutMs ? { handlerTimeoutMs: options.handlerTimeoutMs } : {}),
  }

  let stopping = false
  let loopPromise: Promise<void> | undefined
  let lastCycle: number | null = null
  let pendingWake = false
  let wakeUp: (() => void) | undefined

  function wake(): void {
    pendingWake = true
    wakeUp?.()
  }

  function pause(ms: number): Promise<void> {
    if (pendingWake || stopping) {
      pendingWake = false
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms)
      function done(): void {
        clearTimeout(timer)
        wakeUp = undefined
        pendingWake = false
        resolve()
      }
      wakeUp = done
    })
  }

  async function runOnce(): Promise<DispatchResult[]> {
    const rows = await claimBatch(options.db, options.workerId, batchSize)
    const results = rows.length > 0 ? await dispatchBatch(dispatchDeps, rows) : []
    lastCycle = Date.now()
    return results
  }

  async function loop(): Promise<void> {
    let nextSweepAt = 0
    let failures = 0
    while (!stopping) {
      let claimedFull = false
      try {
        if (Date.now() >= nextSweepAt) {
          const swept = await sweep(options.db)
          nextSweepAt = Date.now() + sweepIntervalMs
          if (swept.reclaimed + swept.deadLettered + swept.purged > 0) {
            options.log.info(swept, 'outbox: sweep')
          }
        }
        const results = await runOnce()
        claimedFull = results.length >= batchSize
        if (failures > 0) options.log.info({ failures }, 'worker: database reachable again')
        failures = 0
      } catch (err) {
        failures += 1
        // Пишем только первую ошибку серии, чтобы недоступная база не забивала лог.
        if (failures === 1) options.log.error({ err }, 'worker: cycle failed')
      }
      if (stopping) break
      if (claimedFull) continue
      const backoff =
        failures > 0
          ? Math.min(pollIntervalMs * 2 ** failures, MAX_ERROR_BACKOFF_MS)
          : pollIntervalMs
      await pause(backoff)
    }
  }

  return {
    runOnce,
    wake,
    lastCycleAt: () => lastCycle,
    start() {
      if (loopPromise) return
      stopping = false
      loopPromise = loop()
    },
    async stop() {
      stopping = true
      wakeUp?.()
      await loopPromise
      loopPromise = undefined
    },
  }
}
