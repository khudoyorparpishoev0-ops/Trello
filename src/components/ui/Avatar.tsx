import type { User } from '@/types'
import { cn } from '@/lib/utils'

interface AvatarProps {
  user: User
  size?: 'xs' | 'sm' | 'md'
  showStatus?: boolean
  className?: string
}

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-caption',
}

/** Avatar с инициалами и индикатором онлайн-статуса (Brand Book §6). */
export function Avatar({ user, size = 'sm', showStatus, className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} title={user.name}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-pill font-semibold text-white',
          'ring-2 ring-surface-2',
          SIZES[size],
        )}
        style={{ background: user.color }}
      >
        {user.initials}
      </span>
      {showStatus && user.online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-pill bg-success ring-2 ring-surface-2"
          aria-label="онлайн"
        />
      )}
    </span>
  )
}

interface AvatarStackProps {
  users: User[]
  max?: number
  size?: 'xs' | 'sm' | 'md'
}

/** Наложенный стек аватаров с «+N». */
export function AvatarStack({ users, max = 3, size = 'sm' }: AvatarStackProps) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  const overlap = size === 'xs' ? '-ml-1.5' : '-ml-2'
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <span key={u.id} className={cn(i > 0 && overlap)}>
          <Avatar user={u} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-pill bg-surface text-muted font-semibold ring-2 ring-surface-2',
            SIZES[size],
            overlap,
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
