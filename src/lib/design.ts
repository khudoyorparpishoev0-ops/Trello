import type { Priority } from '@/types'

/**
 * Прикладные токены дизайн-системы, не выражаемые классами Tailwind напрямую:
 * метаданные приоритетов, палитра меток и цвета стадий.
 *
 * Правило брендбука (стр. 20, 42): насыщенный тон живёт только в точках-
 * индикаторах, полосах и графиках; текст берёт ink-тон того же статуса, а
 * подложка — bg-тон. Поэтому у каждого статуса здесь тройка color / ink / bg,
 * заданная CSS-переменными — значения сами меняются вместе с темой.
 */

export interface PriorityMeta {
  label: string
  /** Насыщенный тон — только для квадрата-индикатора. */
  color: string
  /** Тон текста. */
  ink: string
  /** Подложка плашки. */
  bg: string
  /** Порядок сортировки (критический — выше). */
  weight: number
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  critical: { label: 'Критический', color: 'var(--err)', ink: 'var(--err-ink)', bg: 'var(--err-bg)', weight: 4 },
  high: { label: 'Высокий', color: 'var(--warn)', ink: 'var(--warn-ink)', bg: 'var(--warn-bg)', weight: 3 },
  medium: { label: 'Средний', color: 'var(--info)', ink: 'var(--info-ink)', bg: 'var(--info-bg)', weight: 2 },
  low: { label: 'Низкий', color: '#9AA39C', ink: 'var(--muted)', bg: 'var(--mist)', weight: 1 },
}

export const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']

/**
 * Палитра меток. Метка — плашка с белым текстом 11px, поэтому заливки взяты
 * тёмные: ink-тона статусов и глубокие тона зелёной шкалы брендбука. Бирюза и
 * слива добавлены на том же уровне светлоты — метки задаёт пользователь, и их
 * нужно различать, но выпадать из тональности набора они не должны.
 */
export const LABEL_COLORS: Record<string, string> = {
  green: '#186B36',
  blue: '#23539F',
  amber: '#7A5510',
  red: '#8E2A20',
  violet: '#0E3B21',
  slate: '#3D4E44',
  cyan: '#1D5C63',
  pink: '#7A2E52',
}

export function labelColor(color: string): string {
  return LABEL_COLORS[color] ?? color
}

/**
 * Цвет точки-индикатора стадии (полоса на карточке, точка в шапке колонки).
 * Определяется по названию стадии; пользовательские списки — фирменный зелёный.
 */
export function listAccentColor(title: string): string {
  const t = title.toLowerCase()
  if (/(done|готов|заверш|выполнен)/.test(t)) return 'var(--green)'
  if (/(progress|работ|процесс|review|ревью)/.test(t)) return 'var(--info)'
  if (/(to ?do|бэклог|backlog|выполн|очеред|план)/.test(t)) return '#9AA39C'
  return 'var(--green)'
}

/** Зелёная шкала брендбука — для диаграмм (стр. 20). */
export const GREEN_SCALE = ['#0E3B21', '#186B36', '#22A74E', '#7FBF95', '#B7D6C2', '#DCEAE1']

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
