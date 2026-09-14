import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Утилиты интерфейса.
 *
 * Предметные функции (даты, сроки, коды задач, чек-листы, склонение) живут в
 * общем коде и переэкспортируются отсюда — чтобы существующие импорты
 * компонентов не менялись. Здесь остаётся только то, что завязано на Tailwind.
 */
export * from '#shared/domain/utils'

/** Объединение классов Tailwind с корректным разрешением конфликтов. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
