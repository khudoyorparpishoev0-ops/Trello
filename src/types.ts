/**
 * Логическая модель данных (см. ТЗ логики §2).
 * Иерархия: Пространство → Доска → Список → Карточка → {Чек-лист, Комментарии, Вложения}.
 * В прототипе данные живут в памяти, без бэкенда.
 */

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export type BoardVisibility = 'private' | 'workspace' | 'public'

export type WorkspaceRole = 'observer' | 'member' | 'admin'

/** Пользователь / участник (ТЗ логики §2.2). */
export interface User {
  id: string
  name: string
  /** Инициалы для аватара-заглушки. */
  initials: string
  /** HEX-цвет фона аватара. */
  color: string
  /** Фото профиля (data-URL). Если задано — показывается вместо инициалов. */
  avatar?: string
  /** Отдел (для раздела «Команда»). */
  department?: string
  role?: WorkspaceRole
  online?: boolean
}

/** Метка — цветной тег категории, принадлежит доске (ТЗ логики §5.3). */
export interface Label {
  id: string
  name: string
  /** Ключ семантического цвета либо HEX. */
  color: string
}

/** Пункт чек-листа. */
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/** Чек-лист внутри карточки (ТЗ логики §6.1). */
export interface Checklist {
  id: string
  title: string
  items: ChecklistItem[]
}

/** Комментарий к карточке (ТЗ логики §6.2). */
export interface Comment {
  id: string
  authorId: string
  text: string
  createdAt: string // ISO
  editedAt?: string
}

/** Вложение — файл карточки (ТЗ логики §6.3). */
export interface Attachment {
  id: string
  name: string
  /** Расширение/тип для иконки. */
  kind: string
  /** Размер в байтах. */
  size: number
}

/** Стикеры-переключатели карточки — быстрые свойства с доски (ТЗ «Стикеры и исполнители» §5). */
export interface CardStickers {
  /** Регулярная задача — «каждую неделю». */
  repeat?: boolean
  /** Секундомер — «00:00». */
  stopwatch?: boolean
  /** Таймтрекинг — «spent ч / planned ч». */
  tracking?: boolean
  /** Напоминание — «за 1 ч». */
  reminder?: boolean
}

/** Карточка — единица задачи (ТЗ логики §5). */
export interface Card {
  id: string
  title: string
  description?: string
  labelIds: string[]
  assigneeIds: string[]
  priority: Priority
  /** Дедлайн, ISO-строка. */
  dueDate?: string
  /** Дата начала, не может быть позже дедлайна (ТЗ логики §5.3). */
  startDate?: string
  checklists: Checklist[]
  comments: Comment[]
  attachments: Attachment[]
  createdAt: string
  /**
   * Постоянный числовой код задачи (IT-<code>). Присваивается один раз при
   * создании и больше не меняется. Раньше код выводился хешем из id и давал
   * дубликаты у разных задач — теперь номер уникален в пределах пространства.
   */
  code?: number
  /** Быстрые стикеры, навешиваемые прямо с доски (ТЗ «Стикеры и исполнители»). */
  stickers?: CardStickers
  /** Потрачено часов — для стикера «Таймтрекинг». */
  spent?: number
  /** Запланировано часов — для стикера «Таймтрекинг» (по умолчанию 8). */
  planned?: number
}

/** Список / колонка-стадия (ТЗ логики §4.2). */
export interface List {
  id: string
  title: string
  /** Упорядоченные id карточек. Позиция = индекс в массиве. */
  cardIds: string[]
  /** WIP-лимит (опционально) — при превышении предупреждаем, но не блокируем. */
  wipLimit?: number
  /** Цвет колонки (HEX). Если не задан — выводится по названию стадии. */
  color?: string
  /**
   * Системный признак: задачи этого списка считаются выполненными и не входят
   * в активную статистику (KPI, просрочки, загрузка). Задаётся явно и не
   * зависит от названия — список можно переименовать как угодно.
   * Не задан — включается эвристика по названию (обратная совместимость).
   */
  done?: boolean
}

/** Доска — проект / область работы (ТЗ логики §4.1). */
export interface Board {
  id: string
  name: string
  visibility: BoardVisibility
  /** Упорядоченные id списков. */
  listIds: string[]
  memberIds: string[]
  /** В архиве — скрыта из списка проектов и сайдбара, но не удалена. */
  archived?: boolean
  /** Фон доски: CSS-градиент/цвет (пресет) либо data-URL картинки. Пусто — без фона. */
  background?: string
}

/** Рабочее пространство — контейнер команды (ТЗ логики §2.2). */
export interface Workspace {
  id: string
  name: string
  boards: { id: string; name: string }[]
}

/**
 * Представление одной (активной) доски — то, что видят компоненты.
 * Списки/карточки здесь уже отфильтрованы по активной доске.
 */
export interface BoardState {
  board: Board
  lists: Record<string, List>
  cards: Record<string, Card>
  labels: Record<string, Label>
  users: Record<string, User>
  workspace: Workspace
  /** Текущий пользователь (для фильтра «мои карточки», @-упоминаний). */
  currentUserId: string
}

/**
 * Полное состояние приложения (что хранится на сервере).
 * Несколько досок в одном пространстве; списки/карточки — глобальные словари,
 * доска ссылается на свои списки через listIds.
 */
export interface AppData {
  workspace: Workspace
  users: Record<string, User>
  currentUserId: string
  boards: Record<string, Board>
  /** Порядок досок в пространстве. */
  boardOrder: string[]
  /** Активная (открытая) доска. */
  activeBoardId: string
  lists: Record<string, List>
  cards: Record<string, Card>
  labels: Record<string, Label>
  /** Отделы компании (управляемый список). */
  departments: string[]
}
