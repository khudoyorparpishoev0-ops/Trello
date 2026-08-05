import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Объединение классов Tailwind с корректным разрешением конфликтов. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Простой генератор id для in-memory прототипа. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

const RU_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

/** «21 июл» либо «21 июл, 14:00», если во времени есть значимые часы/минуты. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const month = RU_MONTHS_SHORT[d.getMonth()]
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  if (hasTime) {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month}, ${hh}:${mm}`
  }
  return `${day} ${month}`
}

export type DueStatus = 'overdue' | 'soon' | 'normal' | 'done'

/**
 * Статус дедлайна относительно «сейчас».
 * overdue — просрочено, soon — в пределах 48 ч, done — все задачи закрыты.
 */
export function dueStatus(
  dueDate: string | undefined,
  allDone: boolean,
  now: Date = new Date(),
): DueStatus | null {
  if (!dueDate) return null
  if (allDone) return 'done'
  const due = new Date(dueDate).getTime()
  const diff = due - now.getTime()
  if (diff < 0) return 'overdue'
  if (diff <= 48 * 60 * 60 * 1000) return 'soon'
  return 'normal'
}

/** Человекочитаемый размер файла. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} КБ`
  return `${(kb / 1024).toFixed(1)} МБ`
}

/** Прогресс чек-листов карточки: {done, total}. */
export function checklistProgress(
  checklists: { items: { done: boolean }[] }[],
): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const cl of checklists) {
    for (const it of cl.items) {
      total += 1
      if (it.done) done += 1
    }
  }
  return { done, total }
}

/** Стабильный код задачи вида IT-118 (выводится из id карточки). */
export function taskCode(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 'IT-' + (100 + (h % 900))
}

/**
 * «Таймер создания» карточки в виде часов: MM:SS → H:MM:SS → «Nд HH:MM».
 * Тикает с момента создания; дата создания ставится один раз и не
 * редактируется, поэтому значение всегда достоверно. `now` — для тестов.
 */
export function cardAge(iso?: string, now: number = Date.now()): string {
  if (!iso) return '00:00'
  const ms = now - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600) % 24
  const d = Math.floor(total / 86400)
  const p = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d}д ${p(h)}:${p(m)}`
  if (h > 0) return `${h}:${p(m)}:${p(s)}`
  return `${p(m)}:${p(s)}`
}
