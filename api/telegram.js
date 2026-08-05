// Telegram-бот для уведомлений IT-HONA TaskBoard.
// Работает по long-polling (getUpdates) — HTTPS не требуется.
// - Привязка: пользователь открывает бота по ссылке /start <код> → chat_id
//   сохраняется в его профиль.
// - Напоминания: раз в день (в REMINDER_HOUR по UTC) — дни рождения за 2 дня
//   и дайджест ближайших дедлайнов, всем привязанным пользователям.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const REMINDER_HOUR = Number(process.env.TELEGRAM_REMINDER_HOUR ?? 6) // UTC
const API = `https://api.telegram.org/bot${TOKEN}`

let botUsername = ''
export function getBotUsername() {
  return botUsername
}
export function telegramEnabled() {
  return TOKEN.length > 0
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function tg(method, params) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params ?? {}),
  })
  return res.json()
}

async function send(chatId, text) {
  try {
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  } catch (e) {
    console.error('[tg] send:', e.message)
  }
}

export async function initTelegram(pool) {
  if (!TOKEN) {
    console.log('[tg] выключен (нет TELEGRAM_BOT_TOKEN)')
    return
  }
  try {
    const me = await tg('getMe')
    botUsername = me?.result?.username ?? ''
    console.log(`[tg] бот @${botUsername} запущен`)
  } catch (e) {
    console.error('[tg] getMe не удался:', e.message)
    return
  }
  startPolling(pool)
  startScheduler(pool)
}

// ——— Приём сообщений (привязка) ———
function startPolling(pool) {
  let offset = 0
  const loop = async () => {
    try {
      const r = await tg('getUpdates', { offset, timeout: 30 })
      for (const u of r?.result ?? []) {
        offset = u.update_id + 1
        await handleUpdate(pool, u).catch((e) => console.error('[tg] update:', e.message))
      }
    } catch {
      /* сеть моргнула — повторим */
    }
    setTimeout(loop, 800)
  }
  loop()
}

async function handleUpdate(pool, u) {
  const msg = u.message
  if (!msg || !msg.text) return
  const chatId = String(msg.chat.id)
  const m = /^\/start\s+(\S+)/.exec(msg.text.trim())
  if (m) {
    const code = m[1]
    const { rows } = await pool.query('SELECT id, name FROM users WHERE tg_code = $1', [code])
    if (rows.length) {
      await pool.query('UPDATE users SET tg_chat_id = $1, tg_code = NULL WHERE id = $2', [chatId, rows[0].id])
      await send(chatId, `✅ Готово, <b>${escapeHtml(rows[0].name)}</b>!\nБуду присылать напоминания о днях рождения и дедлайнах.`)
    } else {
      await send(chatId, 'Код не найден или устарел. Получите новый в приложении: Компания → «Подключить Telegram».')
    }
  } else if (/^\/start/.test(msg.text)) {
    await send(chatId, 'Привет! Чтобы получать напоминания, откройте приложение → Компания → «Подключить Telegram» и перейдите по ссылке.')
  } else if (/^\/stop/.test(msg.text)) {
    await pool.query('UPDATE users SET tg_chat_id = NULL WHERE tg_chat_id = $1', [chatId])
    await send(chatId, 'Уведомления отключены. Включить снова — в приложении.')
  }
}

// ——— Планировщик напоминаний ———
function startScheduler(pool) {
  const tick = () => runReminders(pool).catch((e) => console.error('[tg] sched:', e.message))
  setTimeout(tick, 15_000) // первый прогон через 15 сек после старта
  setInterval(tick, 60 * 60 * 1000) // затем раз в час
}

async function runReminders(pool) {
  const now = new Date()
  if (now.getUTCHours() !== REMINDER_HOUR) return

  const linked = await pool.query('SELECT tg_chat_id FROM users WHERE tg_chat_id IS NOT NULL')
  const chatIds = linked.rows.map((r) => r.tg_chat_id)
  if (!chatIds.length) return

  // Дни рождения через 2 дня
  const target = new Date(now)
  target.setUTCDate(now.getUTCDate() + 2)
  const tKey = `${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
  const users = await pool.query("SELECT id, name, birthday FROM users WHERE birthday IS NOT NULL AND birthday <> ''")
  for (const u of users.rows) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(u.birthday)
    if (!m || `${m[2]}-${m[3]}` !== tKey) continue
    if (await alreadySent(pool, `bday:${u.id}:${now.getUTCFullYear()}`)) continue
    for (const cid of chatIds) {
      await send(cid, `🎂 Через 2 дня день рождения у <b>${escapeHtml(u.name)}</b> — не забудьте поздравить!`)
    }
  }

  // Дайджест дедлайнов на сегодня/завтра
  const key = `deadlines:${now.toISOString().slice(0, 10)}`
  if (!(await alreadySent(pool, key))) {
    const board = await pool.query("SELECT data FROM board_state WHERE id = 'default'")
    const due = collectUpcoming(board.rows[0]?.data)
    if (due.length) {
      const lines = due.slice(0, 15).map((d) => `• ${escapeHtml(d.title)} — ${d.when}`).join('\n')
      for (const cid of chatIds) {
        await send(cid, `📌 <b>Дедлайны</b> (сегодня–завтра):\n${lines}`)
      }
    }
  }
}

async function alreadySent(pool, key) {
  const r = await pool.query('INSERT INTO notif_log(key) VALUES($1) ON CONFLICT (key) DO NOTHING RETURNING key', [key])
  return r.rows.length === 0 // если не вставилось — уже отправляли
}

// ——— Уведомления о назначении на задачу ———
// Вызывается при сохранении доски: сравнивает старых и новых исполнителей
// карточек и шлёт Telegram тем, кого только что добавили (у кого привязан бот).
// Дедупликация — по разнице состояний: кто уже был в исполнителях, тому не шлём.
export async function notifyAssignments(pool, oldData, newData, actorId, actorName) {
  if (!TOKEN || !newData || !newData.cards) return
  const oldCards = (oldData && oldData.cards) || {}
  // Собираем всех новоназначенных: cardId → [userId] (исключая уже бывших и автора).
  const targets = new Map() // userId → Set(cardTitle)
  for (const c of Object.values(newData.cards)) {
    const before = new Set(oldCards[c.id]?.assigneeIds ?? [])
    for (const uid of c.assigneeIds ?? []) {
      if (before.has(uid) || uid === actorId) continue
      if (!targets.has(uid)) targets.set(uid, [])
      targets.get(uid).push(c.title)
    }
  }
  if (!targets.size) return
  for (const [uid, titles] of targets) {
    try {
      const { rows } = await pool.query('SELECT tg_chat_id FROM users WHERE id = $1 AND tg_chat_id IS NOT NULL', [uid])
      if (!rows.length) continue
      const chatId = rows[0].tg_chat_id
      const by = actorName ? `\nНазначил(а): ${escapeHtml(actorName)}` : ''
      if (titles.length === 1) {
        await send(chatId, `📌 <b>Вам назначена задача:</b>\n«${escapeHtml(titles[0])}»${by}`)
      } else {
        const list = titles.map((t) => `• ${escapeHtml(t)}`).join('\n')
        await send(chatId, `📌 <b>Вам назначены задачи (${titles.length}):</b>\n${list}${by}`)
      }
    } catch (e) {
      console.error('[tg] assign:', e.message)
    }
  }
}

// Собрать задачи с дедлайном на сегодня/завтра из состояния доски.
function collectUpcoming(data) {
  if (!data || !data.cards || !data.lists) return []
  const now = Date.now()
  const soon = now + 2 * 24 * 3600 * 1000
  const doneListIds = new Set()
  for (const b of Object.values(data.boards ?? {})) {
    for (const lid of b.listIds ?? []) {
      const t = (data.lists[lid]?.title ?? '').toLowerCase()
      if (/(done|готов|заверш|выполнен)/.test(t)) doneListIds.add(lid)
    }
  }
  const doneCards = new Set()
  for (const lid of doneListIds) for (const cid of data.lists[lid]?.cardIds ?? []) doneCards.add(cid)

  const out = []
  for (const c of Object.values(data.cards)) {
    if (!c.dueDate || doneCards.has(c.id)) continue
    const t = new Date(c.dueDate).getTime()
    if (t <= soon) {
      const overdue = t < now
      out.push({ title: c.title, when: overdue ? '⚠️ просрочено' : new Date(c.dueDate).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
    }
  }
  return out
}
