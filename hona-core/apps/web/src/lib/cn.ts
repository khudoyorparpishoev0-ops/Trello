import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Объединение классов Tailwind с корректным разрешением конфликтов.
 * Скопировано из легаси src/lib/utils.ts (§23.3). Реэкспорт предметных функций
 * легаси (`#shared/domain/utils`) намеренно не переносится: они зависят от модели v1.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
