import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  /** Зелёный при 100%, иначе приглушённый бренд. */
  colorByComplete?: boolean
}

/** Индикатор прогресса (Brand Book §7 — прогресс чек-листа карточки). */
export function ProgressBar({ value, max, className, colorByComplete = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const complete = max > 0 && value >= max
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-line', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          'h-full rounded-pill transition-[width] duration-300 ease-smooth',
          colorByComplete && complete ? 'bg-success' : 'bg-brand',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
