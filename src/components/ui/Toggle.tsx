import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: () => void
  /** md — 44×24, sm — 36×20 (строки таблиц). */
  size?: 'md' | 'sm'
  disabled?: boolean
  label?: string
}

/**
 * Переключатель. Дорожка и бегунок прямоугольные с радиусом 2 — круглых форм
 * и «таблеток» в системе нет; бегунок позиционируется через justify-content.
 */
export function Toggle({ checked, onChange, size = 'md', disabled, label }: ToggleProps) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const knob = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'flex shrink-0 items-center rounded-chip p-[3px] transition-colors ease-smooth',
        track,
        checked ? 'justify-end bg-brand-fill' : 'justify-start bg-line-strong',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
      )}
    >
      <span className={cn('rounded-chip bg-white', knob)} />
    </button>
  )
}
