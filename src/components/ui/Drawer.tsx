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
 * Drawer — правая боковая панель (Brand Book §6).
 * Используется для деталей карточки. Radius modal-уровня, анимация 240ms.
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
      {/* Затемнение */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* Панель */}
      <div
        className={cn(
          'relative flex h-full flex-col bg-bg border-l border-line',
          'shadow-md animate-slide-up',
        )}
        style={{ width: `min(${width}px, 100vw)`, animationDuration: '260ms' }}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 shrink-0">
            <div className="min-w-0 flex-1">{title}</div>
            <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
