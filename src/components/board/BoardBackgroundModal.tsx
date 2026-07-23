import { useRef, useState } from 'react'
import { X, Upload, Ban, Check, Loader2 } from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { BG_PRESETS, imageToBackground } from '@/lib/backgrounds'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'

/** Выбор фона активной доски: без фона / пресет-градиент / своя картинка. */
export function BoardBackgroundModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useBoard()
  const board = state.board
  const current = board.background ?? ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (v: string) => actions.setBoardBackground(board.id, v)
  const isImage = current.startsWith('data:image')

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    setBusy(true)
    try {
      const dataUrl = await imageToBackground(file)
      if (dataUrl.length > 3_000_000) setErr('Картинка слишком большая — выберите другую')
      else set(dataUrl)
    } catch {
      setErr('Не удалось обработать изображение')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[440px] rounded-modal border border-line bg-elevated p-5 shadow-md animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-h3 font-semibold text-fg">Фон доски</h3>
          <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
        </div>

        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => set('')}
            title="Без фона"
            className={cn(
              'relative flex h-14 items-center justify-center rounded-card border bg-bg text-faint transition-colors',
              !current ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong',
            )}
          >
            <Ban size={16} strokeWidth={2} />
            {!current && <ActiveDot />}
          </button>
          {BG_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => set(p.css)}
              title={p.label}
              style={{ background: p.css }}
              className={cn(
                'relative h-14 rounded-card border transition-transform hover:scale-[1.03]',
                current === p.css ? 'border-brand ring-1 ring-brand' : 'border-black/20',
              )}
            >
              {current === p.css && <ActiveDot />}
            </button>
          ))}
        </div>

        {isImage && (
          <div className="mt-3 flex items-center gap-2.5 rounded-card border border-brand/40 bg-bg p-2">
            <span
              className="h-10 w-16 shrink-0 rounded-[8px] bg-cover bg-center ring-1 ring-line"
              style={{ backgroundImage: `url("${current}")` }}
            />
            <span className="text-caption text-muted">Своя картинка выбрана</span>
            <Check size={16} className="ml-auto text-brand" />
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-line-strong py-2.5 text-small font-medium text-muted transition-colors hover:border-muted hover:text-fg disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} strokeWidth={2} />}
          Загрузить свой фон
        </button>
        {err && <p className="mt-2 text-caption text-error">{err}</p>}
      </div>
    </div>
  )
}

function ActiveDot() {
  return (
    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-pill bg-brand text-white ring-2 ring-elevated">
      <Check size={11} strokeWidth={3} />
    </span>
  )
}
