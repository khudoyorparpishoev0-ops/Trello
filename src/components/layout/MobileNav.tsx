import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SidebarContent } from './Sidebar'
import { IconButton } from '@/components/ui/IconButton'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

/** Мобильное меню: боковая панель как выезжающий слева drawer (виден только на узких экранах). */
export function MobileNav({ open, onClose }: MobileNavProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface-2 shadow-md animate-slide-up">
        <div className="absolute right-2 top-3">
          <IconButton icon={X} label="Закрыть меню" size="sm" onClick={onClose} />
        </div>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  )
}
