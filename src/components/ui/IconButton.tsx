import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Обязательная подпись для доступности. */
  label: string
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  /** С обводкой — как кнопки уведомлений и темы в шапке. */
  bordered?: boolean
}

const DIMS = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-11 w-11' }
const ICONS = { sm: 16, md: 18, lg: 20 }

/**
 * Квадратная кнопка-иконка. Иконки Lucide с толщиной 1.6px (брендбук §04):
 * контур, без заливки. Зона нажатия у размера lg — 44px, как требует раздел
 * про мобильные экраны.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', active, bordered, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-btn',
        'transition-colors ease-smooth',
        bordered ? 'border border-line' : 'border border-transparent',
        active ? 'bg-brand-bg text-brand-ink' : 'text-muted hover:bg-hover hover:text-fg',
        DIMS[size],
        className,
      )}
      {...props}
    >
      <Icon size={ICONS[size]} strokeWidth={1.6} />
    </button>
  )
})
