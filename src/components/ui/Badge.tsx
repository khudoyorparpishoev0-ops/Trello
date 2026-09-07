import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'muted' | 'ok' | 'warn' | 'err' | 'info' | 'brand'

interface CountBadgeProps {
  icon: LucideIcon
  count: number
  label: string
  tone?: Tone
  className?: string
}

const INK: Record<Tone, string> = {
  muted: 'text-muted',
  ok: 'text-ok-ink',
  warn: 'text-warn-ink',
  err: 'text-err-ink',
  info: 'text-info-ink',
  brand: 'text-brand-ink',
}

/**
 * Иконка + счётчик (комментарии, вложения, чек-лист) в нижнем ряду карточки.
 * Служебный слой — моно, поэтому цифры не пляшут при обновлении.
 */
export function CountBadge({ icon: Icon, count, label, tone = 'muted', className }: CountBadgeProps) {
  return (
    <span
      className={cn('mono-data inline-flex items-center gap-1', INK[tone], className)}
      title={`${label}: ${count}`}
    >
      <Icon size={14} strokeWidth={1.6} />
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

/**
 * Метка карточки — плашка с белым моно-текстом на тёмной заливке (радиус 2).
 * Заливки палитры меток специально тёмные: белый текст 11px на светло-зелёном
 * брендбук запрещает.
 */
export function LabelChip({ name, color, compact }: LabelChipProps) {
  if (compact) {
    return <span className="h-1.5 w-8" style={{ background: color }} title={name} aria-label={name} />
  }
  return (
    <span
      className="mono-label inline-flex items-center rounded-chip px-1.5 py-0.5 text-white"
      style={{ background: color }}
    >
      {name}
    </span>
  )
}

interface PillProps {
  children: ReactNode
  tone?: Tone
  icon?: LucideIcon
  /** Линия 2px слева — для акцентных статусов (брендбук §04). */
  rule?: boolean
  className?: string
}

const PILL_TONES: Record<Tone, string> = {
  muted: 'bg-mist text-muted border-l-line-strong',
  ok: 'bg-ok-bg text-ok-ink border-l-ok',
  warn: 'bg-warn-bg text-warn-ink border-l-warn',
  err: 'bg-err-bg text-err-ink border-l-err',
  info: 'bg-info-bg text-info-ink border-l-info',
  brand: 'bg-brand-bg text-brand-ink border-l-brand',
}

/**
 * Статусная плашка. Насыщенный тон уходит в левую линию, текст — ink-тоном
 * того же статуса; скруглений нет (брендбук: «таблеток» в системе нет).
 */
export function Pill({ children, tone = 'muted', icon: Icon, rule, className }: PillProps) {
  return (
    <span
      className={cn(
        'mono-label inline-flex items-center gap-1.5 px-2 py-1',
        rule && 'border-l-2',
        PILL_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon size={13} strokeWidth={1.6} />}
      {children}
    </span>
  )
}

/** Точка-индикатор 8px. Единственное место, где насыщенный тон стоит сплошняком. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0', className)} style={{ background: color }} aria-hidden />
}
