import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  label?: string
  className?: string
}

/** Checkbox — checked / unchecked / disabled (Brand Book §6). */
export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-200 ease-smooth',
        checked
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-transparent hover:border-muted',
        className,
      )}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  )
}
