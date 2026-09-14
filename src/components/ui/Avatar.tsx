import type { User } from '@/types'
import { cn } from '@/lib/utils'

interface AvatarProps {
  user: User
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showStatus?: boolean
  /** Тёмно-зелёная плитка — для собственного пользователя в сайдбаре. */
  tone?: 'neutral' | 'brand'
  className?: string
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-9 w-9',
  xl: 'h-10 w-10',
}

/**
 * Аватар — квадратная плитка с радиусом 2px (брендбук §04: круглых аватаров и
 * «таблеток» нет). Заливка нейтральная: насыщенный цвет по правилу палитры
 * остаётся за индикаторами и графиками, поэтому людей различают инициалы,
 * набранные служебной моно-гарнитурой.
 */
export function Avatar({ user, size = 'sm', showStatus, tone = 'neutral', className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} title={user.name}>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={cn('rounded-chip border border-line object-cover', SIZES[size])}
        />
      ) : (
        <span
          className={cn(
            'mono-data inline-flex items-center justify-center rounded-chip border',
            tone === 'brand'
              ? 'border-transparent bg-sidebar-active text-white'
              : 'border-line bg-mist text-muted',
            SIZES[size],
          )}
        >
          {user.initials}
        </span>
      )}
      {showStatus && user.online && (
        <span
          className="absolute -bottom-px -right-px h-2 w-2 border border-surface bg-ok"
          aria-label="онлайн"
        />
      )}
    </span>
  )
}

interface AvatarStackProps {
  users: User[]
  max?: number
  size?: AvatarProps['size']
}

/**
 * Ряд аватаров с «+N». Плитки стоят встык с зазором 2px, а не внахлёст:
 * наложение требовало кольца-обводки цветом фона, а на прямоугольных плитках
 * оно читается как брак вёрстки.
 */
export function AvatarStack({ users, max = 3, size = 'sm' }: AvatarStackProps) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  return (
    <div className="flex items-center gap-0.5">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'mono-data inline-flex items-center justify-center rounded-chip border border-line bg-mist text-muted',
            SIZES[size ?? 'sm'],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
