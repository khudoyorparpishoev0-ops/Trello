import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNow } from '@/store/now'
import { deadlineRemaining, dueStatus, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const p2 = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

interface DueDatePickerProps {
  value?: string
  onChange: (iso: string | undefined) => void
}

/**
 * Собственный выбор срока (ТЗ «Выбор срока»): попап с сеткой месяца и
 * колонками ЧАС/МИН. Нативный datetime-local не используется. Значение
 * применяется сразу при клике; «Готово» только закрывает.
 */
export function DueDatePicker({ value, onChange }: DueDatePickerProps) {
  const now = useNow()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<{ y: number; m: number } | null>(null)
  const hourRef = useRef<HTMLDivElement>(null)
  const minRef = useRef<HTMLDivElement>(null)

  const base = value ? new Date(value) : null
  const curH = base ? base.getHours() : 18
  const curM = base ? base.getMinutes() : 0
  const today = new Date()
  const viewMonth = view ?? { y: (base ?? today).getFullYear(), m: (base ?? today).getMonth() }

  // Автопрокрутка колонок времени к выбранному значению — один раз при открытии.
  useEffect(() => {
    if (!open) return
    if (hourRef.current) hourRef.current.scrollTop = Math.max(0, curH * 32 - 96)
    if (minRef.current) minRef.current.scrollTop = Math.max(0, Math.round(curM / 5) * 32 - 96)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 42 ячейки, неделя с понедельника. new Date нормализует m вне 0–11.
  const first = new Date(viewMonth.y, viewMonth.m, 1)
  const dispY = first.getFullYear()
  const dispM = first.getMonth()
  const shift = (first.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(dispY, dispM, 1 - shift + i))
  const selKey = value ? ymd(new Date(value)) : null
  const todayKey = ymd(today)

  // Собрать ISO из даты + времени.
  const composeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), curH, curM, 0, 0).toISOString()
  const composeTime = (h: number, mi: number) => {
    const d = base ?? (() => { const t = new Date(); t.setHours(18, 0, 0, 0); return t })()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, mi, 0, 0).toISOString()
  }

  const pkDay = (d: Date) => {
    onChange(composeDate(d))
    if (d.getMonth() !== dispM || d.getFullYear() !== dispY) setView({ y: d.getFullYear(), m: d.getMonth() })
  }
  const pkToday = () => onChange(composeDate(new Date()))
  const shiftMonth = (delta: number) => setView({ y: viewMonth.y, m: viewMonth.m + delta })

  // Цвет триггера — по состоянию срока (ТЗ Карточка §4.4).
  const status = dueStatus(value, false, new Date(now))
  const dueColor = status === 'overdue' ? '#EF4444' : status === 'soon' ? '#F59E0B' : null
  const triggerStyle: CSSProperties = dueColor
    ? { color: dueColor, background: `color-mix(in srgb, ${dueColor} 14%, transparent)`, borderColor: `color-mix(in srgb, ${dueColor} 30%, transparent)` }
    : { color: 'var(--muted)', borderColor: 'var(--line)' }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setView(null) }}
        style={triggerStyle}
        className="inline-flex items-center gap-[7px] rounded-[10px] border px-[11px] py-[5px] text-[12.5px] font-semibold transition-colors hover:brightness-110"
      >
        <Calendar size={13} strokeWidth={2} />
        <span className="whitespace-nowrap">
          {value ? `${formatDate(value)} · ${deadlineRemaining(value, now)}` : 'Не задан'}
        </span>
        <ChevronDown size={12} strokeWidth={2} className="opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute left-0 top-[calc(100%+8px)] z-30 flex max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-modal border border-line-strong bg-surface sm:flex-row"
            style={{ boxShadow: '0 20px 52px rgba(0,0,0,.5)' }}
          >
            {/* Календарь */}
            <div className="flex w-64 flex-col gap-2.5 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-brand">{MONTHS[dispM]} {dispY}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц" className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-hover hover:text-fg">
                    <ChevronLeft size={15} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц" className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-hover hover:text-fg">
                    <ChevronRight size={15} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="text-center text-[10.5px] font-semibold tracking-[0.04em] text-faint">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d) => {
                  const key = ymd(d)
                  const inMonth = d.getMonth() === dispM && d.getFullYear() === dispY
                  const isSel = key === selKey
                  const isToday = key === todayKey
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pkDay(d)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-[9px] text-[12.5px] tabular-nums transition-[background] duration-150 hover:brightness-[1.4]',
                        isSel
                          ? 'bg-brand font-bold text-white'
                          : inMonth
                            ? 'font-medium text-fg'
                            : 'font-normal text-faint',
                      )}
                      style={isToday && !isSel ? { boxShadow: 'inset 0 0 0 1px var(--line-strong)', fontWeight: 700 } : undefined}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between border-t border-line pt-2">
                <button type="button" onClick={() => { onChange(undefined); setOpen(false) }} className="text-[12.5px] font-semibold text-error hover:brightness-110">
                  Удалить
                </button>
                <button type="button" onClick={pkToday} className="text-[12.5px] font-semibold text-brand hover:brightness-110">
                  Сегодня
                </button>
              </div>
            </div>

            {/* Разделитель (на телефоне попап складывается в колонку) */}
            <div className="h-px w-full bg-line sm:h-auto sm:w-px" />

            {/* Время */}
            <div className="flex flex-col">
              <div className="flex justify-center border-b border-line px-0 pb-1.5 pt-2.5 sm:justify-start">
                <div className="w-[52px] text-center text-[10.5px] font-semibold tracking-[0.06em] text-faint">ЧАС</div>
                <div className="w-[52px] text-center text-[10.5px] font-semibold tracking-[0.06em] text-faint">МИН</div>
              </div>
              <div className="flex justify-center p-1.5 sm:justify-start">
                <div ref={hourRef} className="flex max-h-[150px] w-14 flex-col gap-0.5 overflow-y-auto no-scrollbar sm:max-h-[236px]">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onChange(composeTime(h, curM))}
                      className={cn(
                        'h-[30px] shrink-0 rounded-[8px] text-[12.5px] tabular-nums transition-[background] duration-150 hover:brightness-[1.4]',
                        h === curH ? 'bg-brand font-semibold text-white' : 'font-medium text-muted',
                      )}
                    >
                      {p2(h)}
                    </button>
                  ))}
                </div>
                <div ref={minRef} className="flex max-h-[150px] w-14 flex-col gap-0.5 overflow-y-auto no-scrollbar sm:max-h-[236px]">
                  {MINUTES.map((mi) => (
                    <button
                      key={mi}
                      type="button"
                      onClick={() => onChange(composeTime(curH, mi))}
                      className={cn(
                        'h-[30px] shrink-0 rounded-[8px] text-[12.5px] tabular-nums transition-[background] duration-150 hover:brightness-[1.4]',
                        mi === curM ? 'bg-brand font-semibold text-white' : 'font-medium text-muted',
                      )}
                    >
                      {p2(mi)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-line p-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-[34px] w-full rounded-[10px] bg-brand text-[12.5px] font-semibold text-white transition-[filter] hover:brightness-[1.08]"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
