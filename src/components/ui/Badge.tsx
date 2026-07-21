import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CountBadgeProps {
  icon: LucideIcon
  count: number
  label: string
  /** Подсветить (например, просроченный дедлайн). */
  tone?: 'muted' | 'error' | 'warning' | 'success'
  className?: string
}

const TONES = {
  muted: 'text-muted',
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
}

/** Иконка + счётчик (комментарии, вложения, дедлайн) на карточке. */
export function CountBadge({ icon: Icon, count, label, tone = 'muted', className }: CountBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-caption tabular-nums', TONES[tone], className)}
      title={`${label}: ${count}`}
    >
      <Icon size={14} strokeWidth={2} />
      {count}
    </span>
  )
}

interface LabelChipProps {
  name: string
  color: string
  /** Компактный вид — только цветная полоска без текста. */
  compact?: boolean
}

/** Метка-тег карточки (Brand Book §6 Badge, ТЗ §5.3 Метки). */
export function LabelChip({ name, color, compact }: LabelChipProps) {
  if (compact) {
    return (
      <span
        className="h-1.5 w-8 rounded-pill"
        style={{ background: color }}
        title={name}
        aria-label={name}
      />
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-badge px-2 py-0.5 text-[11px] font-medium leading-4"
      style={{ background: `${color}24`, color }}
    >
      {name}
    </span>
  )
}

interface PillProps {
  children: ReactNode
  tone?: 'muted' | 'brand' | 'error' | 'warning' | 'info' | 'success'
  icon?: LucideIcon
  className?: string
}

const PILL_TONES = {
  muted: 'bg-hover text-muted',
  brand: 'bg-brand-soft text-brand',
  error: 'bg-error-soft text-error',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
}

/** Небольшой статусный «пилюль»-бейдж. */
export function Pill({ children, tone = 'muted', icon: Icon, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium',
        PILL_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2} />}
      {children}
    </span>
  )
}
