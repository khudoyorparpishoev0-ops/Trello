/**
 * Резолвер для запуска тестов встроенным node:test:
 *  - алиас «@/…» → «src/…» (Vite и TS знают его из своих конфигов, Node — нет);
 *  - дописывание расширения .ts/.tsx (в исходниках импорты в стиле бандлера, без расширений).
 * Подключается через --import ./tests/alias-hook.mjs.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('./alias-resolver.mjs', import.meta.url), pathToFileURL('./'))
