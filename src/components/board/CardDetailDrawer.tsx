import { useMemo, useState } from 'react'
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Tag,
  X,
  Send,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Avatar } from '@/components/ui/Avatar'
import { LabelChip, Pill } from '@/components/ui/Badge'
import { Menu } from '@/components/ui/Menu'
import { PriorityDot } from '@/components/ui/Priority'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useBoard } from '@/store/boardStore'
import { PRIORITY_META, PRIORITY_ORDER, listAccentColor } from '@/lib/design'
import { checklistProgress, cn, formatBytes, formatDate, taskCode } from '@/lib/utils'
import { DueDatePicker } from './DueDatePicker'

interface CardDetailDrawerProps {
  cardId: string | null
  onClose: () => void
}


/** Панель деталей карточки (Drawer). Полный набор атрибутов ТЗ логики §5–6. */
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

  return (
    <Drawer
      open={Boolean(cardId)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[12px] font-semibold tracking-[0.02em] text-faint">
            {taskCode(card)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-caption font-medium"
            style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            <span className="h-1.5 w-1.5 rounded-pill" style={{ background: accent }} aria-hidden />
            {list.title}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* Заголовок */}
        <input
          value={card.title}
          onChange={(e) => actions.updateCard(card.id, { title: e.target.value })}
          className="w-full rounded-input bg-transparent text-h3 font-semibold text-fg outline-none focus:bg-surface focus:px-3 focus:py-2"
        />

        {/* Приоритет / список / дедлайн */}
        <div className="grid grid-cols-1 gap-4">
          <Field icon={CheckSquare} label="Приоритет">
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_ORDER.map((p) => {
                const meta = PRIORITY_META[p]
                const active = card.priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => actions.setPriority(card.id, p)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-caption font-medium transition-colors duration-200',
                      active ? 'border-transparent text-white' : 'border-line text-muted hover:text-fg',
                    )}
                    style={active ? { background: meta.color } : undefined}
                  >
                    <PriorityDot priority={p} className={active ? 'bg-white/90' : ''} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* «Срок» и «Список» — в столбик: длинный текст «просрочено на N дн» не
              влезал в половину панели и наезжал на «Список» (ТЗ «Выбор срока» §7). */}
          <div className="grid grid-cols-1 gap-4">
            <Field icon={Calendar} label="Срок">
              <DueDatePicker
                value={card.dueDate}
                onChange={(iso) => actions.updateCard(card.id, { dueDate: iso })}
              />
            </Field>

            <Field icon={AlignLeft} label="Список">
              <select
                value={list.id}
                onChange={(e) => {
                  const target = e.target.value
                  if (target !== list.id) {
                    actions.moveCard(card.id, list.id, target, state.lists[target].cardIds.length)
                  }
                }}
                className="w-full rounded-input border border-line bg-surface px-3 py-2 text-small text-fg outline-none focus:border-brand"
              >
                {state.board.listIds.map((lid) => (
                  <option key={lid} value={lid}>
                    {state.lists[lid].title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Исполнители */}
        <Field icon={UserPlus} label="Исполнители">
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
                className="group flex items-center gap-1.5 rounded-pill bg-surface py-0.5 pl-0.5 pr-2 text-caption text-fg hover:bg-hover"
                title={`Убрать ${u.name}`}
              >
                <Avatar user={u} size="sm" />
                {u.name.split(' ')[0]}
                <X size={12} strokeWidth={2} className="text-faint group-hover:text-error" />
              </button>
            ))}
            {unassigned.length > 0 && (
              <Menu
                align="left"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-7 items-center gap-1 rounded-pill border border-dashed border-line-strong px-2 text-caption text-muted hover:text-fg"
                  >
                    <Plus size={13} strokeWidth={2} /> Назначить
                  </button>
                )}
                items={unassigned.map((u) => ({
                  label: u.name,
                  onClick: () =>
                    actions.updateCard(card.id, { assigneeIds: [...card.assigneeIds, u.id] }),
                }))}
              />
            )}
          </div>
        </Field>

        {/* Метки */}
        <Field icon={Tag} label="Метки">
          <div className="flex flex-wrap items-center gap-1.5">
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
                <LabelChip name={l.name} color={l.color} />
              </button>
            ))}
            {availableLabels.length > 0 && (
              <Menu
                align="left"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-6 items-center gap-1 rounded-badge border border-dashed border-line-strong px-2 text-[11px] text-muted hover:text-fg"
                  >
                    <Plus size={12} strokeWidth={2} /> Метка
                  </button>
                )}
                items={availableLabels.map((l) => ({
                  label: l.name,
                  onClick: () =>
                    actions.updateCard(card.id, { labelIds: [...card.labelIds, l.id] }),
                }))}
              />
            )}
          </div>
        </Field>

        {/* Описание */}
        <Field icon={AlignLeft} label="Описание">
          <textarea
            value={card.description ?? ''}
            onChange={(e) => actions.updateCard(card.id, { description: e.target.value })}
            placeholder="Добавьте описание задачи…"
            rows={3}
            className="w-full resize-y rounded-input border border-line bg-surface px-3 py-2 text-small leading-5 text-fg outline-none focus:border-brand placeholder:text-faint"
          />
        </Field>

        {/* Чек-листы */}
        <Field
          icon={CheckSquare}
          label="Чек-лист"
          aside={total > 0 ? `${done}/${total}` : undefined}
        >
          {total > 0 && <ProgressBar value={done} max={total} className="mb-3" />}
          <div className="flex flex-col gap-4">
            {card.checklists.map((cl) => (
              <div key={cl.id}>
                <p className="mb-1.5 text-caption font-semibold text-muted">{cl.title}</p>
                <div className="flex flex-col gap-1">
                  {cl.items.map((it) => (
                    <label
                      key={it.id}
                      className="flex cursor-pointer items-start gap-2 rounded-[8px] px-1 py-1 hover:bg-hover"
                    >
                      <span className="mt-0.5">
                        <Checkbox
                          checked={it.done}
                          onChange={() => actions.toggleChecklistItem(card.id, cl.id, it.id)}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-small leading-5',
                          it.done ? 'text-faint line-through' : 'text-fg',
                        )}
                      >
                        {it.text}
                      </span>
                    </label>
                  ))}
                </div>
                <AddItem onAdd={(text) => actions.addChecklistItem(card.id, cl.id, text)} />
              </div>
            ))}
            <AddChecklist onAdd={(title) => actions.addChecklist(card.id, title)} />
          </div>
        </Field>

        {/* Вложения */}
        {card.attachments.length > 0 && (
          <Field icon={Paperclip} label="Вложения" aside={String(card.attachments.length)}>
            <div className="flex flex-col gap-2">
              {card.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-input border border-line bg-surface px-3 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-hover text-[10px] font-semibold uppercase text-muted">
                    {a.kind.slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small text-fg">{a.name}</p>
                    <p className="text-caption text-faint">{formatBytes(a.size)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Field>
        )}

        {/* Чат задачи — переписка по задаче */}
        <Field icon={MessageSquare} label="Чат задачи" aside={String(card.comments.length)}>
          {card.comments.length === 0 ? (
            <div className="rounded-input border border-dashed border-line py-6 text-center text-caption text-faint">
              Пока нет сообщений. Начните обсуждение задачи.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {card.comments.map((c) => {
                const author = state.users[c.authorId]
                const mine = c.authorId === state.currentUserId
                return (
                  <div key={c.id} className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
                    {author && <Avatar user={author} size="sm" className="mb-4" />}
                    <div className="min-w-0 max-w-[80%]">
                      <div className={cn('mb-1 flex items-center gap-2 text-[11px]', mine && 'flex-row-reverse')}>
                        <span className="font-medium text-muted">{mine ? 'Вы' : author?.name ?? '—'}</span>
                        <span className="text-faint">{formatDate(c.createdAt)}</span>
                      </div>
                      <div
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-small leading-5',
                          mine
                            ? 'rounded-br-md bg-brand text-white'
                            : 'rounded-bl-md border border-line bg-surface-2 text-fg',
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

          {/* Ввод сообщения */}
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (comment.trim()) {
                    actions.addComment(card.id, comment)
                    setComment('')
                  }
                }
              }}
              placeholder="Написать сообщение…  (Enter — отправить)"
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-small text-fg outline-none focus:border-brand placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => {
                if (comment.trim()) {
                  actions.addComment(card.id, comment)
                  setComment('')
                }
              }}
              disabled={!comment.trim()}
              aria-label="Отправить"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand text-white transition-[filter] duration-150 hover:brightness-110 disabled:opacity-40"
            >
              <Send size={17} strokeWidth={2} />
            </button>
          </div>
        </Field>

        {/* Действия */}
        <div className="flex items-center justify-between border-t border-line pt-4">
          <Pill tone="muted" icon={Calendar}>
            Создано {formatDate(card.createdAt)}
          </Pill>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Save}
              loading={saving}
              onClick={handleSave}
            >
              Сохранить
            </Button>
            <Button
              variant="danger"
              size="sm"
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

/** Подсветка @упоминаний в тексте сообщения (спец §5). */
function renderWithMentions(text: string, mine: boolean): ReactNode {
  return text.split(/(@[\wА-Яа-яЁё.]+)/g).map((part, i) =>
    /^@/.test(part) ? (
      <span key={i} className={cn('font-semibold', mine ? 'text-white underline decoration-white/40' : 'text-brand')}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function Field({
  icon: Icon,
  label,
  aside,
  children,
}: {
  icon: typeof CheckSquare
  label: string
  aside?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={15} strokeWidth={2} className="text-muted" />
        <span className="text-caption font-semibold uppercase tracking-wide text-muted">{label}</span>
        {aside && <span className="text-caption tabular-nums text-faint">· {aside}</span>}
      </div>
      {children}
    </div>
  )
}

function AddItem({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="mt-1 flex items-center gap-2 pl-1">
      <Plus size={14} strokeWidth={2} className="text-faint" />
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
        className="flex-1 bg-transparent text-small text-fg outline-none placeholder:text-faint"
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
        className="inline-flex items-center gap-1.5 self-start rounded-btn px-2 py-1 text-caption font-medium text-muted hover:bg-hover hover:text-fg"
      >
        <Plus size={14} strokeWidth={2} /> Добавить чек-лист
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
        className="flex-1 rounded-input border border-line bg-surface px-3 py-1.5 text-small text-fg outline-none focus:border-brand"
      />
      <Button
        size="sm"
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
