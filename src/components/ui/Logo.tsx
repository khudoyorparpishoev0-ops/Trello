/**
 * Логотип CORE (ТЗ «Логотип CORE»). Знак — изометрический модуль из трёх
 * граней в viewBox 0 0 24 24; объём задаётся прозрачностями (1 / .55 / .82),
 * зазор 0.6 между верхней гранью и боковыми обязателен — без него грани
 * сливаются в мелком масштабе. Пути — дословно из эталона CORE-Logo-B-Module.
 */

interface CoreMarkProps {
  /** Размер знака, px. */
  size: number
  /**
   * Вариант заливки: white — на зелёной плитке; green — зелёный на тёмном
   * без плитки (прозрачности .5/.78 от базового); dim — приглушённый.
   */
  variant?: 'white' | 'green' | 'dim'
}

export function CoreMark({ size, variant = 'white' }: CoreMarkProps) {
  const fill = variant === 'green' ? '#16A34A' : variant === 'dim' ? 'rgba(255,255,255,.72)' : '#fff'
  const [oLeft, oRight] = variant === 'green' ? [0.5, 0.78] : variant === 'dim' ? [0.56, 0.79] : [0.55, 0.82]
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden>
      <path d="M12 2.6 21 7.8 12 13 3 7.8z" fill={fill} />
      <path d="M3 9.6v6.6L11 21v-6.6z" fill={fill} opacity={oLeft} />
      <path d="M21 9.6v6.6L13 21v-6.6z" fill={fill} opacity={oRight} />
    </svg>
  )
}

/** Зелёная плитка со знаком (лок-апы и иконка приложения). */
export function CoreTile({ tile, mark, radius, shadow }: { tile: number; mark: number; radius: number; shadow?: boolean }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-brand"
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        boxShadow: shadow ? '0 10px 30px color-mix(in srgb, #16a34a 28%, transparent)' : undefined,
      }}
    >
      <CoreMark size={mark} />
    </span>
  )
}
