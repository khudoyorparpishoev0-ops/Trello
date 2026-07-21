import { Flag } from 'lucide-react'
import type { Priority } from '@/types'
import { PRIORITY_META } from '@/lib/design'
import { cn } from '@/lib/utils'

interface PriorityFlagProps {
  priority: Priority
  /** Показать текстовую подпись. */
  withLabel?: boolean
  className?: string
}

/** Индикатор приоритета — флажок семантического цвета (ТЗ §5.3, Brand Book §7). */
export function PriorityFlag({ priority, withLabel, className }: PriorityFlagProps) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-caption font-medium', className)}
      style={{ color: meta.color }}
      title={`Приоритет: ${meta.label}`}
    >
      <Flag size={13} strokeWidth={2} fill={meta.color} className="shrink-0" />
      {withLabel && <span>{meta.label}</span>}
    </span>
  )
}

/** Точка-индикатор статуса/приоритета (Brand Book §7 — «полоса или точка»). */
export function PriorityDot({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-pill shrink-0', className)}
      style={{ background: meta.color }}
      title={`Приоритет: ${meta.label}`}
    />
  )
}
