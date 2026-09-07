import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  /** Насыщенный зелёный при 100%, иначе заливка `--fill`. */
  colorByComplete?: boolean
}

/**
 * Полоса прогресса — прямоугольная, 4px по умолчанию. Полоса относится к
 * индикаторам, поэтому насыщенный тон здесь разрешён (брендбук стр. 20).
 */
export function ProgressBar({ value, max, className, colorByComplete = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const complete = max > 0 && value >= max
  return (
    <div
      className={cn('h-1 w-full overflow-hidden bg-track', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          'h-full transition-[width] duration-300 ease-smooth',
          colorByComplete && complete ? 'bg-ok' : 'bg-brand',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
