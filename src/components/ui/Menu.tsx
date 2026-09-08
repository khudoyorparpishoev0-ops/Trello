import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
}

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
}

/** Простое всплывающее меню (dropdown) с закрытием по клику вне и Esc. */
export function Menu({ trigger, items, align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            'absolute z-40 mt-1 min-w-[200px] overflow-hidden rounded-card border border-line bg-elevated py-1 shadow-md animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                item.onClick()
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-small transition-colors ease-smooth',
                item.danger ? 'text-err-ink hover:bg-err-bg' : 'text-fg hover:bg-hover',
              )}
            >
              {item.icon && <item.icon size={16} strokeWidth={1.6} />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
