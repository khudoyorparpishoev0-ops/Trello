import type { Priority } from '@/types'
import { PRIORITY_META } from '@/lib/design'
import { cn } from '@/lib/utils'

interface PriorityFlagProps {
  priority: Priority
  /** Показать текстовую подпись. */
  withLabel?: boolean
  className?: string
}

/**
 * Индикатор приоритета: квадрат 8px насыщенного тона + подпись служебным
 * моно-слоем. Флажок с заливкой заменён квадратом — иконки брендбука только
 * контурные, а цветом здесь работает именно индикатор.
 */
export function PriorityFlag({ priority, withLabel, className }: PriorityFlagProps) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className={cn('mono-data inline-flex items-center gap-1.5 text-muted', className)}
      title={`Приоритет: ${meta.label}`}
    >
      <span className="h-2 w-2 shrink-0" style={{ background: meta.color }} aria-hidden />
      {withLabel && <span>{meta.label.toUpperCase()}</span>}
    </span>
  )
}

/** Только квадрат-индикатор — для плотных списков и таблиц. */
export function PriorityDot({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className={cn('inline-block h-2 w-2 shrink-0', className)}
      style={{ background: meta.color }}
      title={`Приоритет: ${meta.label}`}
    />
  )
}
