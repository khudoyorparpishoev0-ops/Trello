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
console.log('  SMTP_PASS =', process.env.SMTP_PASS ? 'задан' : '(НЕ ЗАДАН)') // сам пароль не печатаем
console.log('')

const ok = await verifyMailer()
if (!ok) {
  console.error('\nПодключиться к серверу почты не удалось — письмо не отправлено.')
  console.error('Проверьте хост, порт, логин и пароль приложения.')
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
