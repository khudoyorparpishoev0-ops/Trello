// Отправка писем с кодом подтверждения регистрации.
//
// Настраивается переменными окружения SMTP_*. Если хост не задан — отправка
// выключена, и сервер работает по-старому, по коду-приглашению: так система не
// остаётся без регистрации, пока почта не настроена.

import nodemailer from 'nodemailer'

const HOST = process.env.SMTP_HOST ?? ''
const PORT = Number(process.env.SMTP_PORT ?? 587)
const USER = process.env.SMTP_USER ?? ''
const PASS = process.env.SMTP_PASS ?? ''
// Явное SMTP_SECURE имеет приоритет; иначе включаем TLS для стандартного 465-го порта.
const SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : PORT === 465
const FROM = process.env.SMTP_FROM || (USER ? `CORE <${USER}>` : '')

let transport = null

/** Настроена ли отправка писем. */
export function mailerEnabled() {
  return HOST.length > 0
}

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: USER ? { user: USER, pass: PASS } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  }
  return transport
}

/** Проверка настроек почты при старте (не роняет сервер при ошибке). */
export async function verifyMailer() {
  if (!mailerEnabled()) {
    console.log('[mail] выключена (нет SMTP_HOST) — регистрация по коду-приглашению')
    return false
  }
  try {
    await getTransport().verify()
    console.log(`[mail] SMTP ${HOST}:${PORT} готов, отправитель: ${FROM}`)
    return true
  } catch (e) {
    console.error('[mail] SMTP недоступен:', e.message)
    return false
  }
}

/** Текст письма с кодом. Простой и без внешних картинок — не попадёт в спам. */
export function buildVerificationMessage(code, minutes) {
  const text = [
    'Подтверждение регистрации в CORE',
    '',
    `Ваш код: ${code}`,
    '',
    `Код действует ${minutes} минут. Введите его на странице регистрации.`,
    'Если вы не запрашивали регистрацию, просто удалите это письмо.',
    '',
    'CORE · Платформа управления задачами IT-HONA',
  ].join('\n')

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1E1E24;line-height:1.5">
  <p style="margin:0 0 16px">Подтверждение регистрации в <b>CORE</b></p>
  <p style="margin:0 0 8px">Ваш код:</p>
  <p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;color:#16A34A">${code}</p>
  <p style="margin:0 0 8px">Код действует ${minutes} минут. Введите его на странице регистрации.</p>
  <p style="margin:0 0 16px;color:#6b7280">Если вы не запрашивали регистрацию, просто удалите это письмо.</p>
  <p style="margin:0;color:#9ca3af;font-size:13px">CORE · Платформа управления задачами IT-HONA</p>
</div>`

  return { subject: `Код подтверждения CORE: ${code}`, text, html }
}

/** Отправить код на адрес. Бросает исключение, если письмо не ушло. */
export async function sendVerificationCode(email, code, ttlMs) {
  const minutes = Math.round(ttlMs / 60000)
  const { subject, text, html } = buildVerificationMessage(code, minutes)
  await getTransport().sendMail({ from: FROM, to: email, subject, text, html })
}
