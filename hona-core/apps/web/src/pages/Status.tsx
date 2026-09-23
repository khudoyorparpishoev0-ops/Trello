import { useQuery } from '@tanstack/react-query'
import { Activity, Database, RefreshCw } from 'lucide-react'
import { systemApi } from '../api/client'
import { Button, Dot, Pill } from '../components/ui'

/**
 * Экран состояния системы (§23.11 п.2): liveness и readiness API.
 * Только чтение: экран ничего не пишет на сервер ни при загрузке, ни при ошибке.
 */
const REFRESH_MS = 10_000

type Tone = 'ok' | 'err' | 'muted'

function StatusRow({
  title,
  description,
  tone,
  label,
}: {
  title: string
  description: string
  tone: Tone
  label: string
}) {
  const color = tone === 'ok' ? 'var(--green)' : tone === 'err' ? 'var(--err)' : 'var(--faint)'
  return (
    <li className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Dot color={color} />
        <div className="min-w-0">
          <p className="text-small font-semibold text-fg">{title}</p>
          <p className="text-caption text-muted">{description}</p>
        </div>
      </div>
      <Pill tone={tone} rule>
        <span data-testid={`${title}-status`}>{label}</span>
      </Pill>
    </li>
  )
}

export function StatusPage() {
  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: ({ signal }) => systemApi.health(signal),
    refetchInterval: REFRESH_MS,
  })
  const readiness = useQuery({
    queryKey: ['system', 'readiness'],
    queryFn: ({ signal }) => systemApi.readiness(signal),
    refetchInterval: REFRESH_MS,
  })

  const liveTone: Tone = health.isError ? 'err' : health.data ? 'ok' : 'muted'
  const liveLabel = health.isError ? 'недоступен' : health.data ? health.data.status : '…'

  const readyTone: Tone = readiness.isError
    ? 'err'
    : readiness.data?.status === 'ok'
      ? 'ok'
      : readiness.data
        ? 'err'
        : 'muted'
  const readyLabel = readiness.isError ? 'недоступен' : readiness.data ? readiness.data.status : '…'

  return (
    <section className="mx-auto w-full max-w-narrow px-6 py-10">
      <p className="mono-label text-muted">Phase 1 · Foundation</p>
      <h1 className="mt-2 text-h1 text-fg">Состояние системы</h1>
      <p className="mt-2 max-w-2xl text-body text-muted">
        Технический экран каркаса HONA Core 2.0. Бизнес-разделы появятся в следующих фазах.
      </p>

      <ul className="mt-8 overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        <StatusRow
          title="API"
          description="GET /api/v1/health — процесс API жив"
          tone={liveTone}
          label={liveLabel}
        />
        <StatusRow
          title="Зависимости"
          description="GET /api/v1/health/ready — PostgreSQL, Redis, MinIO"
          tone={readyTone}
          label={readyLabel}
        />
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-caption text-muted">
        <span className="inline-flex items-center gap-2">
          <Activity size={14} strokeWidth={1.6} />
          {health.data
            ? `версия ${health.data.version}, аптайм ${health.data.uptimeS} с`
            : 'версия —'}
        </span>
        <span className="inline-flex items-center gap-2">
          <Database size={14} strokeWidth={1.6} />
          PostgreSQL — источник истины
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          loading={health.isFetching || readiness.isFetching}
          onClick={() => {
            void health.refetch()
            void readiness.refetch()
          }}
        >
          Обновить
        </Button>
      </div>
    </section>
  )
}
