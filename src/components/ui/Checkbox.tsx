import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  label?: string
  className?: string
}

/** Чекбокс 16px, радиус 2 (брендбук §04). */
export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-chip border transition-colors ease-smooth',
        checked
          ? 'border-transparent bg-brand-fill text-white'
          : 'border-line-strong bg-transparent hover:border-muted',
        className,
      )}
    >
      {checked && <Check size={11} strokeWidth={2.4} />}
    </button>
  )
}
