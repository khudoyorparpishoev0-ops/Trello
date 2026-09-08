import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
}

/**
 * Кнопка. Радиус 4px, заливка — токен `--fill` (в светлой теме #22A74E, в
 * тёмной #186B36): белый текст на зелёном допустим от 14px, поэтому мелких
 * кнопок с заливкой в системе нет — минимальный кегль здесь 14px.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-fill text-white hover:opacity-90 active:opacity-80 disabled:opacity-50',
  secondary:
    'bg-transparent text-fg border border-line-strong hover:bg-hover active:bg-hover disabled:text-faint',
  ghost: 'bg-transparent text-muted hover:bg-hover hover:text-fg active:bg-hover disabled:text-faint',
  danger:
    'bg-transparent text-err-ink border border-err hover:bg-err-bg active:bg-err-bg disabled:opacity-50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-small gap-2',
  md: 'h-10 px-4 text-small gap-2',
  lg: 'h-11 px-4 text-body gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, ...props },
  ref,
) {
  const iconSize = size === 'sm' ? 16 : 18
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-btn font-semibold',
        'transition-[background-color,color,opacity] ease-smooth',
        'disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" strokeWidth={1.6} />
      ) : (
        Icon && <Icon size={iconSize} strokeWidth={1.6} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} strokeWidth={1.6} />}
    </button>
  )
})
