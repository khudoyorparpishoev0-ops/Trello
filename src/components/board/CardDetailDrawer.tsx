import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Save, Trash2, X, Send } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Avatar } from '@/components/ui/Avatar'
import { LabelChip } from '@/components/ui/Badge'
import { Menu } from '@/components/ui/Menu'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useBoard } from '@/store/boardStore'
import { PRIORITY_META, PRIORITY_ORDER, labelColor, listAccentColor } from '@/lib/design'
import { checklistProgress, cn, formatBytes, formatDate, taskCode } from '@/lib/utils'
import { DueDatePicker } from './DueDatePicker'

interface CardDetailDrawerProps {
  cardId: string | null
  onClose: () => void
}

/**
 * Панель деталей карточки.
 *
 * Секции пронумерованы служебным моно-слоем («01 ЗАГОЛОВОК» … «10 ЧАТ ЗАДАЧИ»):
 * панель длинная, и номер даёт опору при прокрутке. Порядок секций не меняется
 * при пустых данных — «Вложения» показывают пустое состояние, а не исчезают,
 * иначе нумерация прыгала бы от карточки к карточке.
 *
 * «Срок» и «Список» стоят в столбик: строка «просрочено на N дн» не помещается
 * в половину ширины панели.
 */
export function CardDetailDrawer({ cardId, onClose }: CardDetailDrawerProps) {
  const { state, actions, saveNow } = useBoard()
  const card = cardId ? state.cards[cardId] : null

  const listId = useMemo(() => {
    if (!cardId) return undefined
    return state.board.listIds.find((lid) => state.lists[lid].cardIds.includes(cardId))
  }, [cardId, state.board.listIds, state.lists])

  const list = listId ? state.lists[listId] : undefined

  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  // «Сохранить» = сохранить и закрыть: сбрасываем состояние на сервер и,
  // если успешно, закрываем панель (возврат на доску — это и есть подтверждение).
  const handleSave = async () => {
    setSaving(true)
    const ok = await saveNow()
    setSaving(false)
    if (ok) onClose()
  }

  if (!card || !list) {
    return null
  }

  const accent = listAccentColor(list.title)
  const { done, total } = checklistProgress(card.checklists)
  const assignees = card.assigneeIds.map((id) => state.users[id]).filter(Boolean)
  const unassigned = state.board.memberIds
    .map((id) => state.users[id])
    .filter((u) => u && !card.assigneeIds.includes(u.id))
  const cardLabels = card.labelIds.map((id) => state.labels[id]).filter(Boolean)
  const availableLabels = Object.values(state.labels).filter((l) => !card.labelIds.includes(l.id))

  const sendComment = () => {
    if (!comment.trim()) return
    actions.addComment(card.id, comment)
    setComment('')
  }

  return (
    <Drawer
      open={Boolean(cardId)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="font-mono text-small font-semibold tracking-data">{taskCode(card)}</span>
          <span
            className="mono-label inline-flex items-center border-l-2 px-2 py-1"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              borderLeftColor: accent,
              color: accent,
            }}
          >
            {list.title}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-6">
        <Field index="01" label="Заголовок">
          <input
            value={card.title}
            onChange={(e) => actions.updateCard(card.id, { title: e.target.value })}
            className="w-full rounded-chip border border-transparent bg-transparent text-h3 text-fg outline-none focus:border-line-strong focus:bg-mist focus:px-3 focus:py-2"
          />
        </Field>

        <Field index="02" label="Приоритет">
          <div className="flex flex-wrap gap-2">
            {PRIORITY_ORDER.map((p) => {
              const meta = PRIORITY_META[p]
              const active = card.priority === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => actions.setPriority(card.id, p)}
                  className={cn(
                    'mono-label inline-flex items-center gap-1.5 px-2 py-1.5 transition-colors ease-smooth',
                    active ? 'border-l-2' : 'border border-line text-muted hover:text-fg',
                  )}
                  style={
                    active
                      ? { background: meta.bg, color: meta.ink, borderLeftColor: meta.color }
                      : undefined
                  }
                >
                  <span className="h-2 w-2 shrink-0" style={{ background: meta.color }} aria-hidden />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field index="03" label="Срок">
          <DueDatePicker
            value={card.dueDate}
            onChange={(iso) => actions.updateCard(card.id, { dueDate: iso })}
          />
        </Field>

        <Field index="04" label="Список">
          <select
            value={list.id}
            onChange={(e) => {
              const target = e.target.value
              if (target !== list.id) {
                actions.moveCard(card.id, list.id, target, state.lists[target].cardIds.length)
              }
            }}
            className="h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand"
          >
            {state.board.listIds.map((lid) => (
              <option key={lid} value={lid}>
                {state.lists[lid].title}
              </option>
            ))}
          </select>
        </Field>

        <Field index="05" label="Исполнители" aside={assignees.length || undefined}>
          <div className="flex flex-wrap items-center gap-2">
            {assignees.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() =>
                  actions.updateCard(card.id, {
                    assigneeIds: card.assigneeIds.filter((id) => id !== u.id),
                  })
                }
                className="group flex items-center gap-2 rounded-chip border border-line bg-mist py-1 pl-1 pr-2 text-caption text-fg transition-colors hover:border-line-strong"
                title={`Убрать ${u.name}`}
              >
                <Avatar user={u} size="sm" />
                {u.name.split(' ')[0]}
                <X size={13} strokeWidth={1.6} className="text-faint group-hover:text-err-ink" />
              </button>
            ))}
            {assignees.length === 0 && (
              <span className="text-caption text-faint">Никто не назначен</span>
            )}
            {unassigned.length > 0 && (
              <Menu
                align="left"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-8 items-center gap-1.5 rounded-chip border border-dashed border-line-strong px-2 text-caption text-muted hover:text-fg"
                  >
                    <Plus size={14} strokeWidth={1.6} /> Назначить
                  </button>
                )}
                items={unassigned.map((u) => ({
                  label: u.name,
                  onClick: () => actions.updateCard(card.id, { assigneeIds: [...card.assigneeIds, u.id] }),
                }))}
              />
            )}
          </div>
        </Field>

        <Field index="06" label="Метки" aside={cardLabels.length || undefined}>
          <div className="flex flex-wrap items-center gap-2">
            {cardLabels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  actions.updateCard(card.id, { labelIds: card.labelIds.filter((id) => id !== l.id) })
                }
                title={`Убрать «${l.name}»`}
                className="transition-opacity hover:opacity-70"
              >
                <LabelChip name={l.name} color={labelColor(l.color)} />
              </button>
            ))}
            {cardLabels.length === 0 && <span className="text-caption text-faint">Меток нет</span>}
            {availableLabels.length > 0 && (
              <Menu
                align="left"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="mono-label inline-flex h-7 items-center gap-1 rounded-chip border border-dashed border-line-strong px-2 text-muted hover:text-fg"
                  >
                    <Plus size={13} strokeWidth={1.6} /> Метка
                  </button>
                )}
                items={availableLabels.map((l) => ({
                  label: l.name,
                  onClick: () => actions.updateCard(card.id, { labelIds: [...card.labelIds, l.id] }),
                }))}
              />
            )}
          </div>
        </Field>

        <Field index="07" label="Описание">
          <textarea
            value={card.description ?? ''}
            onChange={(e) => actions.updateCard(card.id, { description: e.target.value })}
            placeholder="Добавьте описание задачи…"
            rows={4}
            className="w-full resize-y rounded-chip border border-line-strong bg-mist px-3 py-2 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
          />
        </Field>

        <Field index="08" label="Чек-лист" aside={total > 0 ? `${done}/${total}` : undefined}>
          {total > 0 && <ProgressBar value={done} max={total} className="mb-4" />}
          <div className="flex flex-col gap-5">
            {card.checklists.map((cl) => (
              <div key={cl.id}>
                <p className="mb-2 text-caption font-semibold text-muted">{cl.title}</p>
                <div className="flex flex-col gap-0.5">
                  {cl.items.map((it) => (
                    <label
                      key={it.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-chip px-1 py-1.5 hover:bg-hover"
                    >
                      <span className="mt-1">
                        <Checkbox
                          checked={it.done}
                          onChange={() => actions.toggleChecklistItem(card.id, cl.id, it.id)}
                        />
                      </span>
                      <span className={cn('text-body', it.done ? 'text-faint line-through' : 'text-fg')}>
                        {it.text}
                      </span>
                    </label>
                  ))}
                </div>
                <AddItem onAdd={(text) => actions.addChecklistItem(card.id, cl.id, text)} />
              </div>
            ))}
            {card.checklists.length === 0 && (
              <p className="text-caption text-faint">Чек-листов нет — разбейте задачу на шаги.</p>
            )}
            <AddChecklist onAdd={(title) => actions.addChecklist(card.id, title)} />
          </div>
        </Field>

        <Field index="09" label="Вложения" aside={card.attachments.length || undefined}>
          {card.attachments.length === 0 ? (
            <p className="text-caption text-faint">Файлов нет.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {card.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-chip border border-line bg-mist px-3 py-2"
                >
                  <span className="mono-data flex h-10 w-10 items-center justify-center rounded-chip border border-line bg-surface text-muted">
                    {a.kind.slice(0, 4).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-fg">{a.name}</p>
                    <p className="mono-data text-faint">{formatBytes(a.size).toUpperCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field index="10" label="Чат задачи" aside={card.comments.length || undefined}>
          {card.comments.length === 0 ? (
            <div className="rounded-chip border border-dashed border-line px-3 py-6 text-center text-caption text-faint">
              Пока нет сообщений. Начните обсуждение задачи.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {card.comments.map((c) => {
                const author = state.users[c.authorId]
                const mine = c.authorId === state.currentUserId
                return (
                  <div key={c.id} className={cn('flex items-start gap-2', mine && 'flex-row-reverse')}>
                    {author && <Avatar user={author} size="md" />}
                    <div className="min-w-0 max-w-[80%]">
                      <div className={cn('mb-1 flex items-center gap-2', mine && 'flex-row-reverse')}>
                        <span className="text-caption font-semibold text-muted">
                          {mine ? 'Вы' : author?.name ?? '—'}
                        </span>
                        <span className="mono-data text-faint">{formatDate(c.createdAt).toUpperCase()}</span>
                      </div>
                      <div
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-card px-3 py-2 text-body',
                          mine ? 'bg-brand-fill text-white' : 'border border-line bg-mist text-fg',
                        )}
                      >
                        {renderWithMentions(c.text, mine)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 flex items-end gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendComment()
                }
              }}
              placeholder="Написать сообщение…  (Enter — отправить)"
              rows={1}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-chip border border-line-strong bg-mist px-3 py-2.5 text-body text-fg outline-none focus:border-brand placeholder:text-faint"
            />
            <button
              type="button"
              onClick={sendComment}
              disabled={!comment.trim()}
              aria-label="Отправить"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-brand-fill text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send size={18} strokeWidth={1.6} />
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <span className="mono-data text-faint">
            Создано {formatDate(card.createdAt).toUpperCase()}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>
              Сохранить
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                actions.deleteCard(card.id)
                onClose()
              }}
            >
              Удалить
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

/** Подсветка @упоминаний в тексте сообщения. */
function renderWithMentions(text: string, mine: boolean): ReactNode {
  return text.split(/(@[\wА-Яа-яЁё.]+)/g).map((part, i) =>
    /^@/.test(part) ? (
      <span
        key={i}
        className={cn('font-semibold', mine ? 'text-white underline decoration-white/40' : 'text-brand-ink')}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

/** Секция панели: номер + название служебным моно-слоем, при желании — счётчик. */
function Field({
  index,
  label,
  aside,
  children,
}: {
  index: string
  label: string
  aside?: string | number
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="mono-label text-faint">{index}</span>
        <span className="mono-label text-muted">{label}</span>
        {aside !== undefined && <span className="mono-label text-faint">· {aside}</span>}
      </div>
      {children}
    </section>
  )
}

function AddItem({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="mt-2 flex items-center gap-2 pl-1">
      <Plus size={14} strokeWidth={1.6} className="text-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onAdd(value)
            setValue('')
          }
        }}
        placeholder="Добавить пункт…"
        className="flex-1 bg-transparent text-body text-fg outline-none placeholder:text-faint"
      />
    </div>
  )
}

function AddChecklist({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-btn px-2 py-1.5 text-small font-semibold text-muted hover:bg-hover hover:text-fg"
      >
        <Plus size={16} strokeWidth={1.6} /> Добавить чек-лист
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onAdd(value)
            setValue('')
            setOpen(false)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Название чек-листа…"
        className="h-10 flex-1 rounded-chip border border-line-strong bg-surface px-3 text-body text-fg outline-none focus:border-brand"
      />
      <Button
        onClick={() => {
          if (value.trim()) {
            onAdd(value)
            setValue('')
            setOpen(false)
          }
        }}
      >
        Добавить
      </Button>
    </div>
  )
}
