import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface InlineComposerProps {
  triggerLabel: string
  placeholder: string
  submitLabel: string
  onSubmit: (value: string) => void
  /** Стиль триггера: приглушённый (в колонке) или пунктирный (новый список). */
  variant?: 'ghost' | 'dashed'
  /** Акцентный триггер (зелёный) — для кнопки «Добавить» вверху колонки. */
  accent?: boolean
  autoReopen?: boolean
}

/** Инлайн-форма добавления (карточки / списка) с триггером «+». */
export function InlineComposer({
  triggerLabel,
  placeholder,
  submitLabel,
  onSubmit,
  variant = 'ghost',
  accent = false,
  autoReopen = false,
}: InlineComposerProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    const v = value.trim()
    if (!v) return
    onSubmit(v)
    setValue('')
    if (autoReopen) {
      inputRef.current?.focus()
    } else {
      setOpen(false)
    }
  }

  const cancel = () => {
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-btn px-3 text-left text-body',
          'transition-colors ease-smooth',
          variant === 'dashed'
            ? 'border border-dashed border-line-strong text-muted hover:border-muted hover:text-fg'
            : accent
              ? 'border border-dashed border-line-strong text-muted hover:border-brand hover:text-brand-ink'
              : 'text-muted hover:bg-hover hover:text-fg',
        )}
      >
        <Plus size={18} strokeWidth={1.6} />
        {triggerLabel}
      </button>
    )
  }

  return (
    <div className="rounded-card bg-surface p-2 shadow-card animate-scale-in">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          } else if (e.key === 'Escape') {
            cancel()
          }
        }}
        placeholder={placeholder}
        rows={2}
        className={cn(
          'w-full resize-none rounded-input bg-mist px-3 py-2 text-body text-fg',
          'border border-line-strong focus:border-brand focus:outline-none placeholder:text-faint',
        )}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={submit}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" icon={X} onClick={cancel} aria-label="Отменить" />
      </div>
    </div>
  )
}
