import type { Priority } from '@/types'

/**
 * Прикладные токены дизайн-системы, не выражаемые классами Tailwind напрямую:
 * метаданные приоритетов и палитра меток. Соблюдает семантические цвета
 * Brand Book §2.2 (Success/Warning/Error/Info).
 */

export interface PriorityMeta {
  label: string
  /** HEX цвета индикатора. */
  color: string
  /** Полупрозрачный фон для «мягких» бейджей. */
  soft: string
  /** Порядок сортировки (критический — выше). */
  weight: number
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  critical: { label: 'Критический', color: '#EF4444', soft: 'rgba(239,68,68,0.14)', weight: 4 },
  high: { label: 'Высокий', color: '#F59E0B', soft: 'rgba(245,158,11,0.14)', weight: 3 },
  medium: { label: 'Средний', color: '#3B82F6', soft: 'rgba(59,130,246,0.14)', weight: 2 },
  low: { label: 'Низкий', color: '#8E999D', soft: 'rgba(142,153,157,0.16)', weight: 1 },
}

export const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']

/** Палитра меток доски — фирменные и семантические оттенки. */
export const LABEL_COLORS: Record<string, string> = {
  green: '#16A34A',
  blue: '#3B82F6',
  amber: '#F59E0B',
  red: '#EF4444',
  violet: '#8B5CF6',
  cyan: '#06B6D4',
  slate: '#64748B',
  pink: '#EC4899',
}

export function labelColor(color: string): string {
  return LABEL_COLORS[color] ?? color
}

/**
 * Цвет индикатора статуса списка (полоса на карточке, точка в шапке колонки).
 * Определяется по названию стадии; пользовательские списки — фирменный зелёный.
 */
export function listAccentColor(title: string): string {
  const t = title.toLowerCase()
  if (/(done|готов|заверш|выполнен)/.test(t)) return '#22C55E' // success
  if (/(progress|работ|процесс|review|ревью)/.test(t)) return '#3B82F6' // info
  if (/(to ?do|бэклог|backlog|выполн|очеред|план)/.test(t)) return '#8E999D' // neutral
  return '#16A34A' // brand
}

/**
 * Эвристика по названию — только запасной вариант для списков, у которых не
 * задан системный признак `done` (данные, созданные до его появления).
 * Новую логику на неё завязывать нельзя: пользователь вправе назвать список как
 * угодно. Используйте `isListDone(list)`.
 */
export function isDoneList(title: string): boolean {
  return /(done|готов|заверш|выполнен|архив|archive)/.test(title.toLowerCase())
}

/**
 * Считаются ли задачи списка выполненными (не входят в активную статистику).
 * Источник истины — явный флаг `done` у списка; название используется лишь как
 * запасной вариант для старых данных.
 */
export function isListDone(list: { title: string; done?: boolean }): boolean {
  return list.done ?? isDoneList(list.title)
}
