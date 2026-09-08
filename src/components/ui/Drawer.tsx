import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { cn } from '@/lib/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Ширина панели. */
  width?: number
  title?: ReactNode
}

/**
 * Правая выдвижная панель (детали карточки). Оверлей — токен `--overlay`,
 * панель без скруглений: она примыкает к краю экрана, а радиус на стыке
 * читался бы как щель. Закрытие по Esc.
 */
export function Drawer({ open, onClose, children, width = 480, title }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn('relative flex h-full flex-col border-l border-line bg-surface shadow-md animate-panel-in')}
        style={{ width: `min(${width}px, 100vw)`, animationDuration: '260ms' }}
      >
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-6 py-4">
            <div className="min-w-0 flex-1">{title}</div>
            <IconButton icon={X} label="Закрыть" onClick={onClose} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
