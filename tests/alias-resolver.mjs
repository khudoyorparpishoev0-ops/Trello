/** Хук резолвинга: «@/…» → «src/…» и подстановка расширений .ts/.tsx/.js. */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url).href
const EXT = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']

function firstExisting(href) {
  if (existsSync(fileURLToPath(href))) return href
  for (const e of EXT) {
    const candidate = href + e
    if (existsSync(fileURLToPath(candidate))) return candidate
  }
  return null
}

export async function resolve(spec, ctx, next) {
  // Алиас проекта
  if (spec.startsWith('@/')) {
    const found = firstExisting(SRC + spec.slice(2))
    if (found) return next(found, ctx)
  }
  // Относительные импорты без расширения
  if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL) {
    const abs = new URL(spec, ctx.parentURL).href
    const found = firstExisting(abs)
    if (found && found !== abs) return next(found, ctx)
  }
  return next(spec, ctx)
}
