// Проверка полезной нагрузки доски, версионирование и снимки истории.
//
// Доска хранится одним JSON-блобом и перезаписывается целиком, поэтому
// некорректное тело запроса (например `{}` или строка) затирало состояние всей
// компании: фронтенд, не найдя в ответе ожидаемых полей, считал доску пустой.
// Здесь — структурная проверка, сверка версий и снимки предыдущего состояния.

/** Является ли значение обычным объектом-словарём. */
function isDict(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Структурная проверка состояния доски.
 * Возвращает { ok: true } либо { ok: false, error, detail }.
 * Содержимое карточек не валидируется — задача проверки в том, чтобы отсечь
 * заведомо неверный блоб, а не ограничивать модель данных.
 */
export function validateBoardPayload(data) {
  if (!isDict(data)) return { ok: false, error: 'invalid_board', detail: 'ожидается объект состояния доски' }
  for (const key of ['boards', 'lists', 'cards']) {
    if (!isDict(data[key])) return { ok: false, error: 'invalid_board', detail: `поле «${key}» должно быть объектом` }
  }
  if (!Array.isArray(data.boardOrder)) {
    return { ok: false, error: 'invalid_board', detail: 'поле «boardOrder» должно быть массивом' }
  }
  if (typeof data.activeBoardId !== 'string' || !data.activeBoardId) {
    return { ok: false, error: 'invalid_board', detail: 'поле «activeBoardId» обязательно' }
  }
  if (!Object.keys(data.boards).length) {
    return { ok: false, error: 'invalid_board', detail: 'состояние без досок не сохраняется' }
  }
  return { ok: true }
}

/** Число карточек в состоянии (для оценки резких потерь). */
export function cardCount(data) {
  return isDict(data) && isDict(data.cards) ? Object.keys(data.cards).length : 0
}

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000 // не чаще раза в 5 минут
const SHRINK_RATIO = 0.8 // потеря более 20% карточек — снимок обязателен

/**
 * Нужен ли снимок предыдущего состояния перед перезаписью.
 * Снимки делаются разреженно (автосохранение срабатывает часто), но всегда —
 * когда карточек становится заметно меньше: именно такие записи опасны.
 */
export function shouldSnapshot(prevData, newData, lastSnapshotAt, now = Date.now()) {
  if (!prevData) return false
  const before = cardCount(prevData)
  const after = cardCount(newData)
  if (before > 0 && after < before * SHRINK_RATIO) return true
  if (!lastSnapshotAt) return true
  return now - new Date(lastSnapshotAt).getTime() >= SNAPSHOT_INTERVAL_MS
}

/**
 * Разбор версии доски из заголовка `X-Board-Version`.
 * Возвращает целое число либо null, если заголовка нет или он не число:
 * различать «клиент не прислал версию» и «прислал ноль» обязательно.
 */
export function parseVersion(raw) {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}

/**
 * Нужно ли отклонить запись как конфликт версий.
 *
 * Версия отсутствует у клиента — записываем: так ведёт себя фронтенд из
 * кеша браузера, который выкачали до обновления. Отклонять его значило бы
 * сломать работу людям в момент выкладки, а поведение при этом остаётся тем
 * же, что было до версионирования.
 *
 * Версии нет на сервере (строка от прежней схемы) — тоже записываем: сверять
 * не с чем, а первая же запись проставит номер.
 */
export function versionConflict(clientVersion, serverVersion) {
  if (clientVersion === null || clientVersion === undefined) return false
  if (serverVersion === null || serverVersion === undefined) return false
  return Number(clientVersion) !== Number(serverVersion)
}
