import { useCallback, useEffect, useMemo, useState } from 'react'
import { Radar, RefreshCw, ShieldAlert, Info } from 'lucide-react'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { useBoard } from '@/store/boardStore'
import { useAnalytics } from '@/analytics/useAnalytics'
import {
  getCompanyMetrics,
  getDataQualityIssues,
  getProjectMetrics,
  getWipViolations,
  type Scope,
} from '@/analytics'
import { fetchAiStatus, runBrief, type AiStatus, type BriefResult, type Finding } from '@/ai'
import { agentInfo } from '@/ai'
import { cn, countOf, taskCode } from '@/lib/utils'

interface BriefProps {
  onMenuClick: () => void
  onOpenCard: (cardId: string) => void
}

const SEVERITY: Record<Finding['severity'], { tone: 'err' | 'warn' | 'info'; label: string }> = {
  critical: { tone: 'err', label: 'Критично' },
  warning: { tone: 'warn', label: 'Внимание' },
  info: { tone: 'info', label: 'К сведению' },
}

/**
 * Executive Intelligence Layer — брифинг над разделами CORE.
 *
 * Экран устроен по правилу разделения фактов и толкования. Сверху — блок
 * «Факты»: он посчитан слоем аналитики и показывается всегда, даже когда AI
 * выключен или недоступен. Ниже — наблюдения агентов, где факт и интерпретация
 * подписаны отдельно, а к каждому выводу можно раскрыть доказательство.
 *
 * Экран ничего не считает сам и ничего не решает: решение принимает
 * руководитель.
 */
export function Brief({ onMenuClick, onOpenCard }: BriefProps) {
  const { state, boards } = useBoard()
  const ix = useAnalytics()
  const boardId = state.board?.id ?? ''

  const [wholeCompany, setWholeCompany] = useState(true)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [result, setResult] = useState<BriefResult | null>(null)
  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const scope: Scope = useMemo(
    () => (wholeCompany ? {} : { boardId }),
    [wholeCompany, boardId],
  )

  useEffect(() => {
    let cancelled = false
    void fetchAiStatus().then((s) => !cancelled && setStatus(s))
    return () => {
      cancelled = true
    }
  }, [])

  // Смена области обнуляет прошлый брифинг: показывать выводы по компании
  // рядом с фактами одной доски было бы враньём.
  useEffect(() => {
    setResult(null)
    setError(null)
  }, [scope])

  /** Факты области. Считает аналитика — AI здесь не участвует. */
  const facts = useMemo(() => {
    const project = wholeCompany ? null : getProjectMetrics(ix, boardId)
    const company = wholeCompany ? getCompanyMetrics(ix) : null
    const counts = project?.counts ?? company?.counts ?? null
    const quality = getDataQualityIssues(ix, scope)
    return {
      title: wholeCompany ? 'Компания' : (project?.name ?? 'Проект'),
      counts,
      completion: project?.completion ?? company?.completion ?? 0,
      wip: getWipViolations(ix, scope).length,
      invalidDates: quality.invalidDates.length,
      overdueUnassigned: quality.overdueUnassigned.length,
    }
  }, [ix, scope, wholeCompany, boardId])

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    setStage('Аналитика готовит датасеты')
    try {
      setResult(await runBrief(ix, scope, { onProgress: setStage }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось собрать брифинг')
    } finally {
      setRunning(false)
      setStage('')
    }
  }, [ix, scope])

  const aiOff = status !== null && !status.enabled
  // Пока состояние AI неизвестно, кнопка недоступна: клик в этот момент ушёл бы
  // в никуда и вернулся ошибкой.
  const canRun = status?.enabled === true

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Управление"
        title="AI-бриф"
        subtitle="Слой над разделами: аналитика считает, агенты объясняют, решение — за вами"
        onMenuClick={onMenuClick}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-container flex-col gap-6">
          {/* Область и запуск */}
          <section className="flex flex-wrap items-center gap-3 border border-line bg-surface p-4">
            <span className="mono-label text-faint">Область</span>
            <div className="flex">
              <ScopeTab active={wholeCompany} onClick={() => setWholeCompany(true)}>
                Вся компания
              </ScopeTab>
              <ScopeTab
                active={!wholeCompany}
                disabled={!boardId}
                onClick={() => setWholeCompany(false)}
              >
                {state.board?.name ?? 'Текущий проект'}
              </ScopeTab>
            </div>
            <span className="mono-data ml-auto text-faint">
              {countOf(boards.length, ['проект', 'проекта', 'проектов'])} ·{' '}
              {countOf(Object.keys(state.users).length, ['сотрудник', 'сотрудника', 'сотрудников'])}
            </span>
            <Button icon={RefreshCw} onClick={run} loading={running} disabled={running || !canRun}>
              {status === null ? 'Проверяем AI…' : result ? 'Собрать заново' : 'Собрать брифинг'}
            </Button>
          </section>

          {/* Факты — всегда, без AI */}
          <Panel
            title="Факты"
            sub={`Посчитано слоем аналитики · ${facts.title}`}
            note="Без AI"
          >
            {facts.counts === null ? (
              <p className="text-body text-muted">Данных пока нет.</p>
            ) : (
              <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 xl:grid-cols-6">
                <Fact label="Активные" value={facts.counts.active} />
                <Fact label="Просрочено" value={facts.counts.overdue} tone={facts.counts.overdue > 0 ? 'err' : undefined} />
                <Fact label="Срок ≤48 ч" value={facts.counts.dueSoon} />
                <Fact label="Без исполнителя" value={facts.counts.unassigned} />
                <Fact label="Без срока" value={facts.counts.noDueDate} />
                <Fact label="Закрыто" value={`${facts.completion}%`} />
              </div>
            )}
            {(facts.wip > 0 || facts.invalidDates > 0 || facts.overdueUnassigned > 0) && (
              <p className="mt-4 border-t border-line pt-4 text-caption text-muted">
                Ещё в данных: превышений WIP — {facts.wip}, просрочено и ничьих —{' '}
                {facts.overdueUnassigned}, начало позже срока — {facts.invalidDates}.
              </p>
            )}
          </Panel>

          {/* Состояние AI */}
          {aiOff && (
            <Notice icon={Info} title="AI выключен">
              {status?.reason ?? 'Провайдер не настроен.'} Факты выше посчитаны без него — на них
              работают и дашборд, и отчёты. Чтобы включить толкование, задайте в окружении сервера
              переменную <code className="mono-data">ANTHROPIC_API_KEY</code> и перезапустите API.
            </Notice>
          )}

          {error && (
            <Notice icon={ShieldAlert} title="Брифинг не собран" tone="err">
              {error}
            </Notice>
          )}

          {running && (
            <Panel title="Идёт разбор" sub={stage}>
              <p className="text-body text-muted">
                Агенты получают только выжимку своей области — не базу CORE.
              </p>
            </Panel>
          )}

          {result && !running && <BriefBody result={result} users={state.users} onOpenCard={onOpenCard} />}

          {!result && !running && !aiOff && (
            <Panel title="Брифинг не собран" sub="Нажмите «Собрать брифинг»">
              <p className="max-w-[70ch] text-body text-muted">
                Порядок работы: аналитика считает метрики области, каждый доменный агент получает
                только свою выжимку, его выводы сверяются с фактами, и лишь проверенное попадает в
                сводку руководителя.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

/** Тело брифинга: сводка, наблюдения, отчёт о проверке. */
function BriefBody({
  result,
  users,
  onOpenCard,
}: {
  result: BriefResult
  users: Record<string, { id: string; name: string; initials: string; color: string }>
  onOpenCard: (cardId: string) => void
}) {
  const { brief } = result
  return (
    <>
      <Panel title="Сводка" sub="Executive Agent · видит только проверенные наблюдения">
        <p className="max-w-[70ch] text-body text-fg">{brief.summary}</p>
        {brief.ok.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {brief.ok.map((line) => (
              <li key={line} className="flex items-start gap-2 text-caption text-muted">
                <span className="mt-1.5 h-2 w-2 shrink-0 bg-brand" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <FindingList
        title="Требует внимания"
        findings={brief.attention}
        empty="Ничего срочного агенты не выделили."
        users={users}
        onOpenCard={onOpenCard}
      />
      <FindingList
        title="Под наблюдением"
        findings={brief.watch}
        empty="Наблюдений этого уровня нет."
        users={users}
        onOpenCard={onOpenCard}
      />

      <Panel title="Проверка выводов" sub="Что сверено с фактами">
        <div className="flex flex-col gap-3">
          {result.reports.map((r) => (
            <div key={r.agent} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="min-w-[160px] text-body text-fg">{agentInfo(r.agent).title}</span>
              <span className="mono-data text-muted">
                принято {r.accepted.length} · отклонено {r.rejected.length}
              </span>
              {r.insufficientData && (
                <span className="text-caption text-muted">{r.insufficientData}</span>
              )}
            </div>
          ))}
        </div>
        {result.rejectedCount > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-caption text-muted">
              Отклонено {countOf(result.rejectedCount, ['вывод', 'вывода', 'выводов'])}. Вывод отбрасывается, если в нём есть число,
              которого не было в данных, или ссылка на несуществующую задачу, сотрудника, проект
              или отдел.
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {result.reports.flatMap((r) =>
                r.rejected.map((rej, i) => (
                  <li key={`${r.agent}_${i}`} className="text-caption text-faint">
                    «{rej.finding.title}» — {rej.reason}
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </Panel>
    </>
  )
}

function FindingList({
  title,
  findings,
  empty,
  users,
  onOpenCard,
}: {
  title: string
  findings: Finding[]
  empty: string
  users: Record<string, { id: string; name: string; initials: string; color: string }>
  onOpenCard: (cardId: string) => void
}) {
  return (
    <Panel title={title} sub={countOf(findings.length, ['наблюдение', 'наблюдения', 'наблюдений'])}>
      {findings.length === 0 ? (
        <p className="text-body text-muted">{empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} users={users} onOpenCard={onOpenCard} />
          ))}
        </div>
      )}
    </Panel>
  )
}

/**
 * Одно наблюдение. Факт и интерпретация подписаны раздельно намеренно:
 * читатель должен видеть, где данные, а где мнение агента.
 */
function FindingCard({
  finding,
  users,
  onOpenCard,
}: {
  finding: Finding
  users: Record<string, { id: string; name: string; initials: string; color: string }>
  onOpenCard: (cardId: string) => void
}) {
  const sev = SEVERITY[finding.severity]
  const ev = finding.evidence
  const people = (ev.userIds ?? []).map((id) => users[id]).filter(Boolean)

  return (
    <article className="border border-line bg-mist p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="text-h3 text-fg">{finding.title}</h3>
        <Pill tone={sev.tone} rule>
          {sev.label}
        </Pill>
        <span className="mono-label ml-auto text-faint">{agentInfo(finding.agent).title}</span>
      </header>

      <dl className="mt-3 flex flex-col gap-2">
        <div>
          <dt className="mono-label text-faint">Факт</dt>
          <dd className="mt-1 text-body text-fg">{finding.fact}</dd>
        </div>
        <div>
          <dt className="mono-label text-faint">Интерпретация AI</dt>
          <dd className="mt-1 border-l-2 border-line-strong pl-3 text-body text-muted">
            {finding.interpretation}
          </dd>
        </div>
        <div>
          <dt className="mono-label text-faint">Предложение</dt>
          <dd className="mt-1 text-body text-fg">{finding.recommendation}</dd>
        </div>
      </dl>

      <details className="mt-3 border-t border-line pt-3">
        <summary className="mono-label cursor-pointer text-muted">Доказательства</summary>
        <div className="mt-3 flex flex-col gap-3">
          {ev.metrics.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {ev.metrics.map((m) => (
                <li key={m.name} className="mono-data border border-line bg-surface px-2 py-1 text-muted">
                  {m.name}: <span className="text-fg">{m.value}</span>
                </li>
              ))}
            </ul>
          )}
          {people.length > 0 && (
            <ul className="flex flex-wrap items-center gap-3">
              {people.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <Avatar user={u} size="sm" />
                  <span className="text-caption text-fg">{u.name}</span>
                </li>
              ))}
            </ul>
          )}
          {(ev.cardIds ?? []).length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {(ev.cardIds ?? []).map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onOpenCard(id)}
                    className="mono-data border border-line bg-surface px-2 py-1 text-muted transition-colors hover:border-line-strong hover:text-fg"
                  >
                    {taskCode(id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(ev.departments ?? []).length > 0 && (
            <p className="text-caption text-muted">Отделы: {(ev.departments ?? []).join(', ')}</p>
          )}
        </div>
      </details>
    </article>
  )
}

// ——— Мелкие части экрана ———

function Panel({
  title,
  sub,
  note,
  children,
}: {
  title: string
  sub?: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-line bg-surface p-6">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-h2 text-fg">{title}</h2>
        {sub && <span className="text-caption text-muted">{sub}</span>}
        {note && (
          <span
            className="mono-label ml-auto text-faint"
            title="Блок посчитан слоем аналитики и показывается независимо от AI"
          >
            {note}
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

function Fact({ label, value, tone }: { label: string; value: number | string; tone?: 'err' }) {
  return (
    <div className="bg-surface p-4">
      <p className="mono-label text-faint">{label}</p>
      <p className={cn('mt-1 text-h1 tabular-nums', tone === 'err' ? 'text-err-ink' : 'text-fg')}>
        {value}
      </p>
    </div>
  )
}

function ScopeTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'mono-label min-h-[36px] border px-3 py-2 transition-colors first:border-r-0',
        active
          ? 'border-brand bg-brand-fill text-white'
          : 'border-line bg-surface text-muted hover:text-fg',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  )
}

function Notice({
  icon: Icon,
  title,
  tone = 'info',
  children,
}: {
  icon: typeof Radar
  title: string
  tone?: 'info' | 'err'
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'flex gap-3 border p-4',
        tone === 'err' ? 'border-err bg-err-bg' : 'border-line bg-mist',
      )}
    >
      <Icon size={18} strokeWidth={1.6} className={tone === 'err' ? 'text-err-ink' : 'text-muted'} />
      <div>
        <p className="text-body font-semibold text-fg">{title}</p>
        <p className="mt-1 max-w-[70ch] text-caption text-muted">{children}</p>
      </div>
    </section>
  )
}
