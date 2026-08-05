import type {
  AppData,
  Attachment,
  Board,
  Card,
  Comment,
  List,
  User,
} from '@/types'
import { uid } from '@/lib/utils'

/** Отделы компании по умолчанию. */
export const DEFAULT_DEPARTMENTS = [
  'Стратегического планирования',
  'Информационных технологий (IT)',
  'Закупок и снабжения',
  'Отдел проектирования',
  'Производственный отдел',
  'Финансовый отдел',
]

/** Новая пустая доска с тремя списками (To Do / In Progress / Done). */
export function emptyBoard(
  id: string,
  name: string,
  memberIds: string[],
): { board: Board; lists: Record<string, List> } {
  const todo: List = { id: uid('list'), title: 'To Do', cardIds: [] }
  const prog: List = { id: uid('list'), title: 'In Progress', cardIds: [], wipLimit: 5 }
  const done: List = { id: uid('list'), title: 'Done', cardIds: [] }
  const lists: Record<string, List> = { [todo.id]: todo, [prog.id]: prog, [done.id]: done }
  const board: Board = { id, name, visibility: 'private', listIds: [todo.id, prog.id, done.id], memberIds }
  return { board, lists }
}

/**
 * Демо-данные доски «Платформа задач» (разработка IT-HONA TaskBoard).
 * Даты вычисляются относительно текущего момента, чтобы подсветка дедлайнов
 * (просрочено / скоро) всегда была наглядной, когда бы прототип ни открыли.
 */

const DAY = 24 * 60 * 60 * 1000

function buildDates() {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const at = (offsetDays: number, h = 0, m = 0) =>
    new Date(base.getTime() + offsetDays * DAY + h * 3600_000 + m * 60_000).toISOString()
  return { at }
}

const USERS: User[] = [
  { id: 'u_alisher', name: 'Алишер Каримов', initials: 'АК', color: '#3B82F6', role: 'admin', online: true, department: 'Информационных технологий (IT)' },
  { id: 'u_dilnoza', name: 'Дилноза Пулатова', initials: 'ДП', color: '#EC4899', role: 'member', online: true, department: 'Отдел проектирования' },
  { id: 'u_egor', name: 'Егор Соколов', initials: 'ЕС', color: '#F59E0B', role: 'member', online: false, department: 'Информационных технологий (IT)' },
  { id: 'u_maria', name: 'Мария Ким', initials: 'МК', color: '#8B5CF6', role: 'member', online: true, department: 'Производственный отдел' },
  { id: 'u_timur', name: 'Тимур Рахимов', initials: 'ТР', color: '#06B6D4', role: 'observer', online: false, department: 'Стратегического планирования' },
]

const COMMENT_POOL = [
  'Согласовал с командой, можно брать в работу.',
  'Обновил макеты, посмотрите последнюю версию.',
  'Нужно учесть пограничный случай с потерей соединения.',
  'Добавил ссылку на спецификацию в описание.',
  'Проверил на мобильном — всё ок.',
  'Давайте вынесем это в отдельную карточку.',
  '@Алишер Каримов, глянь, пожалуйста, приоритет.',
  'Готово к ревью.',
]

function mkComments(n: number, authorIds: string[], at: (d: number, h?: number, m?: number) => string): Comment[] {
  return Array.from({ length: n }, (_, i): Comment => ({
    id: uid('c'),
    authorId: authorIds[i % authorIds.length],
    text: COMMENT_POOL[i % COMMENT_POOL.length],
    createdAt: at(-((n - i) * 1) - 1, 9 + i, 15),
  }))
}

function mkAttachments(names: string[]): Attachment[] {
  return names.map((n): Attachment => {
    const kind = n.split('.').pop() ?? 'file'
    const size = 40_000 + n.length * 9000
    return { id: uid('a'), name: n, kind, size }
  })
}

export function createSeedState(): AppData {
  const { at } = buildDates()

  const labels = {
    l_design: { id: 'l_design', name: 'Дизайн', color: 'violet' },
    l_frontend: { id: 'l_frontend', name: 'Фронтенд', color: 'blue' },
    l_backend: { id: 'l_backend', name: 'Бэкенд', color: 'green' },
    l_infra: { id: 'l_infra', name: 'Инфраструктура', color: 'slate' },
    l_bug: { id: 'l_bug', name: 'Баг', color: 'red' },
    l_docs: { id: 'l_docs', name: 'Документация', color: 'cyan' },
  }

  const cardsArr: Card[] = [
    // ——— To Do ———
    {
      id: 'card_import',
      title: 'Импорт досок из Trello',
      description: 'Парсинг экспорта Trello и маппинг на модель данных (доски, списки, карточки, метки).',
      labelIds: ['l_backend'],
      assigneeIds: ['u_egor'],
      priority: 'medium',
      dueDate: at(8, 18),
      checklists: [
        {
          id: uid('cl'), title: 'Этапы', items: [
            { id: uid('i'), text: 'Разобрать формат экспорта', done: false },
            { id: uid('i'), text: 'Маппинг сущностей', done: false },
            { id: uid('i'), text: 'Импорт вложений', done: false },
            { id: uid('i'), text: 'Тесты миграции', done: false },
          ],
        },
      ],
      comments: [
        { id: uid('c'), authorId: 'u_egor', text: 'Начал переносить доски из Trello. Экспорт JSON готов.', createdAt: at(-2, 10, 5) },
        { id: uid('c'), authorId: 'u_alisher', text: 'Отлично. Не забудь про метки и вложения — они тоже должны переехать.', createdAt: at(-2, 11, 20) },
        { id: uid('c'), authorId: 'u_dilnoza', text: '@Алишер Каримов, а переписку в карточках тоже переносим?', createdAt: at(-1, 9, 15) },
        { id: uid('c'), authorId: 'u_alisher', text: 'Да, чат по задачам сохраняем полностью — вся история должна остаться.', createdAt: at(-1, 9, 40) },
        { id: uid('c'), authorId: 'u_egor', text: 'Принято, добавляю комментарии в импорт. Готово к ревью завтра.', createdAt: at(-1, 18, 0) },
      ],
      attachments: mkAttachments(['trello-export-sample.json']),
      createdAt: at(-10),
    },
    {
      id: 'card_onboarding',
      title: 'Онбординг и пустые состояния',
      description: 'Экраны первого входа, пустые доски/списки, подсказки.',
      labelIds: ['l_design'],
      assigneeIds: ['u_maria'],
      priority: 'low',
      checklists: [
        {
          id: uid('cl'), title: 'Экраны', items: [
            { id: uid('i'), text: 'Пустая доска', done: false },
            { id: uid('i'), text: 'Пустой список', done: false },
            { id: uid('i'), text: 'Первый вход', done: false },
          ],
        },
      ],
      comments: [],
      attachments: [],
      createdAt: at(-6),
    },
    {
      id: 'card_recovery',
      title: 'Восстановление пароля по e-mail',
      description: 'Флоу сброса пароля: запрос, письмо со ссылкой, установка нового пароля, завершение прочих сессий.',
      labelIds: ['l_backend', 'l_frontend'],
      assigneeIds: ['u_dilnoza'],
      priority: 'high',
      dueDate: at(1, 16),
      checklists: [
        {
          id: uid('cl'), title: 'Шаги', items: [
            { id: uid('i'), text: 'Эндпоинт запроса сброса', done: true },
            { id: uid('i'), text: 'Шаблон письма', done: false },
            { id: uid('i'), text: 'Экран нового пароля', done: false },
          ],
        },
      ],
      comments: mkComments(1, ['u_dilnoza'], at),
      attachments: [],
      createdAt: at(-4),
      stickers: { reminder: true },
    },
    {
      id: 'card_notif',
      title: 'Настройки уведомлений (каналы)',
      description: 'Управление каналами: в приложении, push, e-mail, Telegram. Привязка бота.',
      labelIds: ['l_frontend'],
      assigneeIds: ['u_maria', 'u_timur'],
      priority: 'medium',
      dueDate: at(6, 12),
      checklists: [],
      comments: [],
      attachments: mkAttachments(['notif-matrix.pdf', 'tg-bot-flow.png']),
      createdAt: at(-3),
    },

    // ——— In Progress ———
    {
      id: 'card_kanban_design',
      title: 'Дизайн канбан-доски и карточки',
      description: 'Строгий, информативный вид карточки: статус, исполнитель, дедлайн, приоритет, прогресс.',
      labelIds: ['l_design'],
      assigneeIds: ['u_maria', 'u_alisher'],
      priority: 'high',
      dueDate: at(3, 18),
      checklists: [
        {
          id: uid('cl'), title: 'Состав карточки', items: [
            { id: uid('i'), text: 'Индикатор статуса', done: true },
            { id: uid('i'), text: 'Метки и приоритет', done: true },
            { id: uid('i'), text: 'Дедлайн с подсветкой', done: true },
            { id: uid('i'), text: 'Прогресс чек-листа', done: true },
            { id: uid('i'), text: 'Счётчики комментариев/файлов', done: false },
            { id: uid('i'), text: 'Состояние hover', done: false },
          ],
        },
      ],
      comments: mkComments(5, ['u_maria', 'u_alisher', 'u_dilnoza'], at),
      attachments: mkAttachments(['card-spec.fig', 'states.png', 'grid-8px.png']),
      createdAt: at(-9),
      stickers: { tracking: true, repeat: true },
      spent: 5,
      planned: 8,
    },
    {
      id: 'card_dnd',
      title: 'Drag-and-drop карточек и списков',
      description: 'Перетаскивание внутри списка и между списками; пересчёт позиций без коллизий.',
      labelIds: ['l_frontend'],
      assigneeIds: ['u_alisher'],
      priority: 'critical',
      dueDate: at(1, 20),
      checklists: [
        {
          id: uid('cl'), title: 'Реализация', items: [
            { id: uid('i'), text: 'Сенсоры указателя и клавиатуры', done: true },
            { id: uid('i'), text: 'Sortable внутри списка', done: true },
            { id: uid('i'), text: 'Перенос между списками', done: true },
            { id: uid('i'), text: 'Drag overlay', done: true },
            { id: uid('i'), text: 'Оптимистичное обновление', done: true },
            { id: uid('i'), text: 'Позиции без пересчёта всех', done: false },
            { id: uid('i'), text: 'Клавиатурная доступность', done: false },
            { id: uid('i'), text: 'Автоскролл', done: false },
          ],
        },
      ],
      comments: mkComments(3, ['u_alisher', 'u_egor'], at),
      attachments: [],
      createdAt: at(-7),
    },
    {
      id: 'card_db',
      title: 'Схема БД и модель данных',
      description: 'PostgreSQL: пространства, доски, списки, карточки, метки, вложения, активность.',
      labelIds: ['l_backend'],
      assigneeIds: ['u_egor'],
      priority: 'high',
      dueDate: at(-1, 12),
      checklists: [
        {
          id: uid('cl'), title: 'Таблицы', items: [
            { id: uid('i'), text: 'Пользователи и сессии', done: true },
            { id: uid('i'), text: 'Доски и списки', done: true },
            { id: uid('i'), text: 'Карточки и связи', done: true },
            { id: uid('i'), text: 'Индексы и позиции', done: false },
            { id: uid('i'), text: 'Миграции', done: false },
          ],
        },
      ],
      comments: mkComments(4, ['u_egor', 'u_alisher'], at),
      attachments: mkAttachments(['er-diagram.png']),
      createdAt: at(-11),
    },
    {
      id: 'card_tokens',
      title: 'Токены дизайн-системы (Tailwind)',
      description: 'Синхронизация цветов, типографики, отступов, радиусов и теней с фронтендом.',
      labelIds: ['l_design', 'l_frontend'],
      assigneeIds: ['u_alisher'],
      priority: 'medium',
      dueDate: at(2, 15),
      checklists: [
        {
          id: uid('cl'), title: 'Токены', items: [
            { id: uid('i'), text: 'Цвета (бренд + семантика)', done: true },
            { id: uid('i'), text: 'Типографическая шкала', done: true },
            { id: uid('i'), text: 'Сетка и отступы 8px', done: true },
            { id: uid('i'), text: 'Радиусы', done: true },
            { id: uid('i'), text: 'Тени', done: true },
            { id: uid('i'), text: 'Анимации', done: true },
          ],
        },
      ],
      comments: mkComments(1, ['u_maria'], at),
      attachments: [],
      createdAt: at(-5),
    },

    // ——— Done ———
    {
      id: 'card_scaffold',
      title: 'Каркас проекта: React + TypeScript + Vite',
      description: 'Инициализация репозитория, структура папок, конфигурация сборки и линтера.',
      labelIds: ['l_frontend', 'l_infra'],
      assigneeIds: ['u_alisher'],
      priority: 'medium',
      checklists: [
        {
          id: uid('cl'), title: 'Готово', items: [
            { id: uid('i'), text: 'Vite + React + TS', done: true },
            { id: uid('i'), text: 'Tailwind', done: true },
            { id: uid('i'), text: 'ESLint', done: true },
          ],
        },
      ],
      comments: mkComments(2, ['u_alisher', 'u_egor'], at),
      attachments: mkAttachments(['structure.md']),
      createdAt: at(-14),
    },
    {
      id: 'card_figma',
      title: 'Макеты экранов в Figma',
      description: 'UI Kit, доска, карточка, дашборд. Auto Layout, variables, component variants.',
      labelIds: ['l_design'],
      assigneeIds: ['u_maria'],
      priority: 'low',
      checklists: [
        {
          id: uid('cl'), title: 'Экраны', items: [
            { id: uid('i'), text: 'UI Kit', done: true },
            { id: uid('i'), text: 'Доска', done: true },
            { id: uid('i'), text: 'Карточка', done: true },
            { id: uid('i'), text: 'Дашборд', done: true },
            { id: uid('i'), text: 'Дизайн-токены', done: true },
          ],
        },
      ],
      comments: mkComments(6, ['u_maria', 'u_alisher', 'u_dilnoza'], at),
      attachments: mkAttachments(['ui-kit.fig', 'board.png', 'card.png', 'dashboard.png']),
      createdAt: at(-16),
    },
    {
      id: 'card_positions',
      title: 'Правила перемещения и позиций карточек',
      description: 'Дробные позиции для вставки между элементами без пересчёта всего списка.',
      labelIds: ['l_backend'],
      assigneeIds: ['u_egor'],
      priority: 'medium',
      checklists: [
        {
          id: uid('cl'), title: 'Готово', items: [
            { id: uid('i'), text: 'Алгоритм позиций', done: true },
            { id: uid('i'), text: 'Разрешение конфликтов', done: true },
          ],
        },
      ],
      comments: [],
      attachments: [],
      createdAt: at(-13),
    },
  ]

  const cards: Record<string, Card> = {}
  for (const c of cardsArr) cards[c.id] = c

  const platformLists: Record<string, List> = {
    list_todo: {
      id: 'list_todo',
      title: 'To Do',
      cardIds: ['card_import', 'card_onboarding', 'card_recovery', 'card_notif'],
    },
    list_progress: {
      id: 'list_progress',
      title: 'In Progress',
      cardIds: ['card_kanban_design', 'card_dnd', 'card_db', 'card_tokens'],
      wipLimit: 5,
    },
    list_done: {
      id: 'list_done',
      title: 'Done',
      cardIds: ['card_scaffold', 'card_figma', 'card_positions'],
    },
  }

  const users: Record<string, User> = {}
  for (const u of USERS) users[u.id] = u
  const memberIds = USERS.map((u) => u.id)

  // Ещё две доски пространства — пока пустые, с дефолтными списками.
  const mobile = emptyBoard('board_mobile', 'Мобильное приложение', memberIds)
  const infra = emptyBoard('board_infra', 'Инфраструктура', memberIds)

  const boards: Record<string, Board> = {
    board_platform: {
      id: 'board_platform',
      name: 'Платформа задач',
      visibility: 'private',
      listIds: ['list_todo', 'list_progress', 'list_done'],
      memberIds,
    },
    board_mobile: mobile.board,
    board_infra: infra.board,
  }

  return {
    workspace: { id: 'ws_ithona', name: 'IT-HONA', boards: [] },
    users,
    currentUserId: 'u_alisher',
    boards,
    boardOrder: ['board_platform', 'board_mobile', 'board_infra'],
    activeBoardId: 'board_platform',
    lists: { ...platformLists, ...mobile.lists, ...infra.lists },
    cards,
    labels,
    departments: [...DEFAULT_DEPARTMENTS],
  }
}
