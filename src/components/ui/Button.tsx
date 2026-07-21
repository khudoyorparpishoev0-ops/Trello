import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
}

/** Button — Primary / Secondary / Ghost / Danger (Brand Book §6). Radius 14px. */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-[#15913f] active:bg-[#127a36] disabled:bg-brand/50 shadow-sm',
  secondary:
    'bg-transparent text-fg border border-line-strong hover:bg-hover active:bg-hover disabled:text-faint',
  ghost:
    'bg-transparent text-muted hover:bg-hover hover:text-fg active:bg-hover disabled:text-faint',
  danger:
    'bg-error text-white hover:bg-[#dc2f2f] active:bg-[#c62828] disabled:bg-error/50 shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-10 px-4 text-small gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, ...props },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-btn font-medium',
        'transition-colors duration-200 ease-smooth',
        'disabled:cursor-not-allowed select-none',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" strokeWidth={2} />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={2} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} strokeWidth={2} />}
    </button>
  )
})
