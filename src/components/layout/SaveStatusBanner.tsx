import { useState } from 'react'
import { AlertTriangle, RefreshCw, Upload, ShieldAlert, X } from 'lucide-react'
import { useBoard } from '@/store/boardStore'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'

/**
 * Полоса состояния сохранения над содержимым экрана.
 *
 * Два случая, и оба раньше проходили молча:
 *
 * • Конфликт версий — доску успел изменить другой участник, сервер отклонил
 *   запись, автосохранение остановлено. Набранный текст с экрана не
 *   откатывается: человек выбирает, чью версию оставить. Молча выбрать за него
 *   нельзя — в обоих случаях чья-то работа теряется.
 *
 * • Изменение отклонено по правам (удаление проекта доступно администратору).
 *   Состояние уже подтянуто с сервера, поэтому здесь только объяснение
 *   причины: без него пропавший и вернувшийся проект выглядел бы сбоем.
 */
export function SaveStatusBanner() {
  const { mode, notice, dismissNotice, reloadFromServer, overwriteServer } = useBoard()
  const [busy, setBusy] = useState<'reload' | 'overwrite' | null>(null)

  if (mode === 'conflict') {
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

  if (notice) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-center gap-4 border-b border-line border-l-2 border-l-err bg-err-bg px-4 py-3 sm:px-8"
      >
        <ShieldAlert size={20} strokeWidth={1.6} className="shrink-0 text-err-ink" />
        <div className="min-w-0 flex-1">
          <p className="mono-label text-err-ink">Изменение отклонено</p>
          <p className="mt-1 text-caption text-fg">{notice}</p>
        </div>
        <IconButton icon={X} label="Скрыть сообщение" onClick={dismissNotice} className="shrink-0" />
      </div>
    )
  }

  return null
}
