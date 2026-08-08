// Проверка настроек почты: отправляет тестовое письмо и печатает результат.
//
// Запуск на сервере (из каталога проекта):
//   docker compose exec api node send-test-mail.js ваш.адрес@ithona.tj
//
// Скрипт ничего не меняет в базе — только проверяет подключение и отправку.

import { mailerEnabled, sendVerificationCode, verifyMailer } from './mailer.js'

const to = process.argv[2]

if (!to) {
  console.error('Укажите адрес получателя:\n  node send-test-mail.js ваш.адрес@ithona.tj')
  process.exit(1)
}

if (!mailerEnabled()) {
  console.error(
    'Отправка выключена: не задан SMTP_HOST.\n' +
      'Заполните переменные SMTP_* в файле .env и перезапустите: docker compose up -d api',
  )
  process.exit(1)
}

console.log('Настройки:')
console.log('  SMTP_HOST =', process.env.SMTP_HOST)
console.log('  SMTP_PORT =', process.env.SMTP_PORT ?? '587 (по умолчанию)')
console.log('  SMTP_USER =', process.env.SMTP_USER || '(не задан)')
console.log('  SMTP_FROM =', process.env.SMTP_FROM || '(берётся из SMTP_USER)')
// Сам пароль не печатаем — только признаки, по которым видно порчу значения.
const pass = process.env.SMTP_PASS ?? ''
const passInfo = pass
  ? `задан, длина ${pass.length}` +
    (/\s/.test(pass) ? ' — ВНИМАНИЕ: содержит пробел или перенос строки' : '') +
    (/^["']|["']$/.test(pass) ? ' — ВНИМАНИЕ: значение в кавычках, их быть не должно' : '') +
    (pass.includes('$') ? ' — ВНИМАНИЕ: содержит $, в .env его нужно удвоить ($$)' : '')
  : '(НЕ ЗАДАН)'
console.log('  SMTP_PASS =', passInfo)
console.log('')

const ok = await verifyMailer()
if (!ok) {
  console.error('\nПодключиться к серверу почты не удалось — письмо не отправлено.')
  console.error('\nЕсли ответ был «535 Authentication Failed», проверьте по порядку:')
  console.error('  0. Сервер соответствует тарифу: у платного тарифа Zoho с почтой на своём')
  console.error('     домене это smtppro.zoho.com (не smtp.zoho.com).')
  console.error(`  1. Ящик ${process.env.SMTP_USER || '(SMTP_USER)'} действительно существует`)
  console.error('     (Zoho Mail Admin → Пользователи).')
  console.error('  2. Пароль приложения создан ПОД ЭТИМ ЖЕ ящиком: нужно войти в')
  console.error('     accounts.zoho.com именно как этот пользователь, а не как администратор,')
  console.error('     затем Security → App Passwords. Это самая частая причина отказа.')
  console.error('  3. Взят пароль приложения, а не обычный пароль от почты.')
  console.error('  4. У ящика разрешён доступ по SMTP (Настройки → Почтовые аккаунты → IMAP/SMTP).')
  console.error('  5. В .env значение без кавычек, пробелов и переносов строки.')
  process.exit(1)
}

try {
  await sendVerificationCode(to, '123456', 15 * 60 * 1000)
  console.log(`\nГотово: тестовое письмо с кодом 123456 отправлено на ${to}.`)
  console.log('Если письма нет — посмотрите папку «Спам».')
  process.exit(0)
} catch (e) {
  console.error('\nОтправить письмо не удалось:', e.message)
  console.error('Частые причины: неверный пароль приложения; отправитель не совпадает с логином;')
  console.error('доступ по SMTP выключен в настройках почтового ящика.')
  process.exit(1)
}
