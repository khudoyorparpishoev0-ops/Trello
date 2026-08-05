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

/**
 * Обратный отсчёт до дедлайна для таймера в шапке карточки (спец §4.3 countdown):
 * не просрочено — `Nд HH:MM` или `HH:MM` (меньше суток); просрочено — `−Nд` / `−N ч`.
 */
export function deadlineCountdown(dueIso: string | undefined, now: number = Date.now()): string {
  if (!dueIso) return ''
  const diff = new Date(dueIso).getTime() - now
  if (Number.isNaN(diff)) return ''
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const mins = Math.floor((abs % 3600000) / 60000)
  const p = (n: number) => String(n).padStart(2, '0')
  if (diff < 0) {
    if (days >= 1) return `−${days}д`
    if (hours >= 1) return `−${hours} ч`
    return `−${mins} мин`
  }
  if (days >= 1) return `${days}д ${p(hours)}:${p(mins)}`
  return `${p(hours)}:${p(mins)}`
}

/**
 * Полная формулировка остатка для панели задачи (спец §4.3 remaining):
 * `осталось N дн N ч` / `осталось N ч NN мин` / `просрочено на N дн`.
 */
export function deadlineRemaining(dueIso: string | undefined, now: number = Date.now()): string {
  if (!dueIso) return ''
  const diff = new Date(dueIso).getTime() - now
  if (Number.isNaN(diff)) return ''
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86400000)
  const hours = Math.floor((abs % 86400000) / 3600000)
  const mins = Math.floor((abs % 3600000) / 60000)
  if (diff < 0) {
    if (days >= 1) return `просрочено на ${days} дн`
    if (hours >= 1) return `просрочено на ${hours} ч`
    return `просрочено на ${mins} мин`
  }
  if (days >= 1) return `осталось ${days} дн ${hours} ч`
  return `осталось ${hours} ч ${String(mins).padStart(2, '0')} мин`
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
