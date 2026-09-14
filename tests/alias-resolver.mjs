/**
 * Хук резолвинга для тестов: «@/…» → «src/…», «#shared/…» → «shared/…»,
 * подстановка расширений и разрешение «./x.js» в «./x.ts».
 *
 * Последнее нужно общему коду: там импорты несут расширение `.js`, потому что
 * именно так Node выполняет собранный ESM, а исходник при этом — TypeScript.
 */
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url).href
const SHARED = new URL('../shared/', import.meta.url).href
const EXT = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']

/** Файл ли это (папка не годится: Node не умеет импортировать каталог). */
function isFile(href) {
  const path = fileURLToPath(href)
  return existsSync(path) && statSync(path).isFile()
}

function firstExisting(href) {
  if (isFile(href)) return href
  // «./analyze.js» в общем коде — это «./analyze.ts» на диске.
  if (href.endsWith('.js')) {
    const ts = href.slice(0, -3) + '.ts'
    if (isFile(ts)) return ts
  }
  for (const e of EXT) {
    const candidate = href + e
    if (isFile(candidate)) return candidate
  }
  return null
}

export async function resolve(spec, ctx, next) {
  // Алиасы проекта
  if (spec.startsWith('@/')) {
    const found = firstExisting(SRC + spec.slice(2))
    if (found) return next(found, ctx)
  }
  if (spec.startsWith('#shared/')) {
    const found = firstExisting(SHARED + spec.slice('#shared/'.length))
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
