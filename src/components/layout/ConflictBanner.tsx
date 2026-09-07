import { useState } from 'react'
import { AlertTriangle, RefreshCw, Upload } from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { Button } from '@/components/ui/Button'

/**
 * Плашка конфликта версий.
 *
 * Появляется, когда доску успел изменить другой участник: сервер отклонил
 * запись, автосохранение остановлено. Набранный текст с экрана не откатывается —
 * решение принимает человек:
 *  • «Обновить» — взять версию сервера, потеряв свои несохранённые правки;
 *  • «Записать мою версию» — перезаписать доску собой, потеряв чужие.
 *
 * Молча выбрать за пользователя нельзя: в обоих случаях чья-то работа теряется,
 * и раньше это происходило незаметно.
 */
export function ConflictBanner() {
  const { mode, reloadFromServer, overwriteServer } = useBoard()
  const [busy, setBusy] = useState<'reload' | 'overwrite' | null>(null)

  if (mode !== 'conflict') return null

  const reload = async () => {
    setBusy('reload')
    await reloadFromServer()
    setBusy(null)
  }
  const overwrite = async () => {
    setBusy('overwrite')
    await overwriteServer()
    setBusy(null)
  }

  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-line border-l-2 border-l-warn bg-warn-bg px-4 py-3 sm:px-8"
    >
      <AlertTriangle size={20} strokeWidth={1.6} className="shrink-0 text-warn-ink" />
      <div className="min-w-0 flex-1">
        <p className="mono-label text-warn-ink">Доска изменена</p>
        <p className="mt-1 text-caption text-fg">
          Её успел изменить другой участник, поэтому ваши правки не сохранены. Они остались на
          экране — выберите, чью версию оставить.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button icon={RefreshCw} onClick={reload} loading={busy === 'reload'} disabled={busy !== null}>
          Обновить
        </Button>
        <Button
          variant="secondary"
          icon={Upload}
          onClick={overwrite}
          loading={busy === 'overwrite'}
          disabled={busy !== null}
        >
          Записать мою версию
        </Button>
      </div>
    </div>
  )
}
