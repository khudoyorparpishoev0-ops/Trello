import type { ReactNode } from 'react'
import { Menu, Search, Bell, Sun, Moon, Server } from 'lucide-react'
import type { User } from '@/types'
import { useBoard } from '@/store/boardStore'
import { useTheme } from '@/store/theme'
import { useNow } from '@/store/now'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'

interface ScreenHeaderProps {
  /** Первый сегмент хлебных крошек — раздел. */
  kicker: string
  title: string
  subtitle?: string
  /** Плашка рядом с заголовком (например, «ПРИВАТНАЯ»). */
  badge?: ReactNode
  onMenuClick: () => void
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  members?: User[]
  /** Второй ряд шапки: виды, фильтры, вкладки. */
  children?: ReactNode
}

/**
 * Единая шапка контента для всех экранов (брендбук §06, раздел 2.2 хендоффа).
 * Раньше каждый экран рисовал свою — отсюда расхождения в кегле заголовков и
 * отсутствие крошек; теперь состав и порядок задаются в одном месте.
 *
 * Блок сервера обязателен: он показывает локальный режим, когда бэкенд
 * недоступен и правки не сохраняются.
 */
export function ScreenHeader({
  kicker,
  title,
  subtitle,
  badge,
  onMenuClick,
  search,
  members,
  children,
}: ScreenHeaderProps) {
  const { mode } = useBoard()
  const { theme, toggle } = useTheme()
  const now = useNow()

  const local = mode === 'local'
  const conflict = mode === 'conflict'
  const date = new Date(now)
  const dateLabel = date
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(' г.', '')
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'long' })
  const timeLabel = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      {/*
        Порядок элементов задан классами order-*: на узких экранах в первой
        строке стоят бургер, заголовок и кнопки, а поиск переносится под них
        целой строкой; с xl всё выстраивается в один ряд слева направо.
      */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6">
        <IconButton icon={Menu} label="Меню" onClick={onMenuClick} className="order-1 -ml-1 lg:hidden" />

        <div className="order-2 min-w-0 flex-1 xl:min-w-[300px]">
          <p className="truncate text-small text-muted">
            {kicker} &nbsp;/&nbsp; <span className="text-fg">{title}</span>
          </p>
          {/*
            Плашка переносится под заголовок, когда строке не хватает места:
            усечь название доски нельзя — это главный элемент экрана.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="mt-0.5 min-w-0 truncate text-h3 sm:text-h1">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1 truncate text-caption text-muted">{subtitle}</p>}
        </div>

        {search && (
          <label className="order-4 flex h-11 w-full items-center gap-2 rounded-chip border border-line bg-mist px-3 text-muted xl:order-3 xl:w-[220px]">
            <Search size={18} strokeWidth={1.6} className="shrink-0" />
            <input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Поиск'}
              className="min-w-0 flex-1 border-0 bg-transparent text-body text-fg outline-none"
            />
          </label>
        )}

        {members && members.length > 0 && (
          <div className="order-5 hidden items-center gap-0.5 xl:order-4 xl:flex">
            {members.slice(0, 4).map((u) => (
              <Avatar key={u.id} user={u} size="lg" />
            ))}
            {members.length > 4 && (
              <span className="mono-data flex h-9 w-9 items-center justify-center rounded-chip border border-line bg-mist text-muted">
                +{members.length - 4}
              </span>
            )}
          </div>
        )}

        <div
          className="order-6 hidden items-center gap-3 border-x border-line px-4 text-muted xl:order-5 xl:flex"
          title={
            conflict
              ? 'Доску изменил другой участник — автосохранение остановлено'
              : local
                ? 'Сервер недоступен — изменения не сохраняются'
                : 'Данные сохраняются на сервере'
          }
        >
          <Server size={20} strokeWidth={1.6} className="shrink-0" />
          <span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0"
                style={{ background: conflict ? 'var(--err)' : local ? 'var(--warn)' : 'var(--green)' }}
                aria-hidden
              />
              <span
                className={
                  conflict
                    ? 'mono-label text-err-ink'
                    : local
                      ? 'mono-label text-warn-ink'
                      : 'mono-label text-brand-ink'
                }
              >
                {conflict ? 'Конфликт' : local ? 'Локально' : 'Сервер'}
              </span>
            </span>
            <span className="mt-0.5 block text-caption text-muted">
              {conflict
                ? 'Доска изменена другим участником'
                : local
                  ? 'Изменения не сохраняются'
                  : 'Все системы в норме'}
            </span>
          </span>
        </div>

        <div className="order-7 hidden whitespace-nowrap text-right xl:order-6 xl:block">
          <span className="block text-body font-semibold">{dateLabel}</span>
          <span className="block text-caption text-muted">{timeLabel}</span>
        </div>

        <div className="order-3 flex shrink-0 items-center gap-2 xl:order-7">
          <span className="relative inline-flex">
            <IconButton icon={Bell} label="Уведомления" size="lg" bordered />
            <span className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 bg-err" aria-hidden />
          </span>
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            size="lg"
            bordered
            onClick={toggle}
          />
        </div>
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-4 px-4 pb-3 sm:gap-6 sm:px-8">{children}</div>
      )}
    </header>
  )
}
