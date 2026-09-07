import { cn } from '@/lib/utils'

/**
 * Лок-апы CORE.
 *
 * Знак IT-HONA не перерисовывается: по брендбуку он берётся готовым файлом из
 * официального пакета (`ithona_mark-green.svg` и выворотка `-white`), а
 * пересохранённый логотип считается браком. Файлы выдаёт владелец бренда, в
 * пакет редизайна они не входят — до их получения используется текстовый
 * лок-ап и фирменная плитка со срезом угла 60°. Когда файл появится, подставьте
 * его внутрь `CoreTile` вместо подписи.
 */

interface CoreTileProps {
  /** Сторона плитки, px. */
  size: number
  className?: string
}

/**
 * Тёмно-зелёная плитка со срезом верхнего правого угла под 60° (брендбук §04:
 * допустимы только 60° и 30°). Подпись — служебный моно-слой.
 */
export function CoreTile({ size, className }: CoreTileProps) {
  return (
    <span
      className={cn('flex shrink-0 items-end bg-sidebar p-2', className)}
      style={{
        width: size,
        height: size,
        clipPath: `polygon(0 0, calc(100% - ${Math.round(size * 0.55)}px) 0, 100% ${Math.round(size * 0.32)}px, 100% 100%, 0 100%)`,
      }}
      aria-hidden
    >
      <span className="mono-label text-white">CORE</span>
    </span>
  )
}

interface CoreWordmarkProps {
  /** Тёмный фон (сайдбар) или светлая поверхность. */
  tone?: 'onDark' | 'onLight'
  className?: string
}

/** Текстовый лок-ап: рубрика IT-HONA над названием продукта. */
export function CoreWordmark({ tone = 'onDark', className }: CoreWordmarkProps) {
  return (
    <span className={cn('block', className)}>
      <span className={cn('mono-label block', tone === 'onDark' ? 'text-sidebar-muted' : 'text-muted')}>
        IT&#8209;HONA
      </span>
      <span
        className={cn(
          'mt-1 block text-h3 tracking-[0.02em]',
          tone === 'onDark' ? 'text-white' : 'text-fg',
        )}
      >
        CORE
      </span>
    </span>
  )
}
