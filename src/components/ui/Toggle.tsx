import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: () => void
  /** md — 46×26 (профиль/общие), sm — 44×24 (строки таблиц). */
  size?: 'md' | 'sm'
  disabled?: boolean
  label?: string
}

/** Переключатель по спецификации §6: бегунок позиционируется через justify-content. */
export function Toggle({ checked, onChange, size = 'md', disabled, label }: ToggleProps) {
  const track = size === 'sm' ? 'h-6 w-11' : 'h-[26px] w-[46px]'
  const knob = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'flex shrink-0 items-center rounded-pill p-[3px] transition-colors duration-200',
        track,
        checked ? 'justify-end bg-brand' : 'justify-start bg-line-strong',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
      )}
    >
      <span className={cn('rounded-pill bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]', knob)} />
    </button>
  )
}
