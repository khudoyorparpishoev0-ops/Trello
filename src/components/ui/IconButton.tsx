import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Обязательная подпись для доступности. */
  label: string
  size?: 'sm' | 'md'
  active?: boolean
}

/** Квадратная кнопка-иконка (шапка, тулбары). Иконки Lucide, 2px. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', active, className, ...props },
  ref,
) {
  const dims = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = size === 'sm' ? 16 : 18
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-btn shrink-0',
        'transition-colors duration-200 ease-smooth',
        'text-muted hover:bg-hover hover:text-fg',
        active && 'bg-hover text-fg',
        dims,
        className,
      )}
      {...props}
    >
      <Icon size={iconSize} strokeWidth={2} />
    </button>
  )
})
