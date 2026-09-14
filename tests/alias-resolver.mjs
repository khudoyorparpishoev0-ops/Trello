/** Хук резолвинга: «@/…» → «src/…» и подстановка расширений .ts/.tsx/.js. */
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url).href
const EXT = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']

/** Файл ли это (папка не годится: Node не умеет импортировать каталог). */
function isFile(href) {
  const path = fileURLToPath(href)
  return existsSync(path) && statSync(path).isFile()
}

function firstExisting(href) {
  if (isFile(href)) return href
  for (const e of EXT) {
    const candidate = href + e
    if (isFile(candidate)) return candidate
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
