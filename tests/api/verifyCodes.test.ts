/**
 * Тесты кодов подтверждения регистрации и письма с кодом.
 * Отправка проверяется на настоящем SMTP-обмене с локальным тестовым сервером.
 * Запуск: npm run test:api
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  canResend,
  checkStoredCode,
  codeMatches,
  generateCode,
  hashCode,
  resendWaitSeconds,
} from '../../api/verifyCodes.js'
import { buildVerificationMessage } from '../../api/mailer.js'

// ——— Генерация кода ———

test('код — шесть цифр', () => {
  for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/)
})

test('коды не повторяются подряд (источник случайности рабочий)', () => {
  const set = new Set(Array.from({ length: 300 }, () => generateCode()))
  assert.ok(set.size > 200, `слишком мало разных кодов: ${set.size}`)
})

// ——— Хранение ———

test('в базе хранится хеш, а не сам код', () => {
  const code = '123456'
  const h = hashCode('ivan@ithona.tj', code)
  assert.notEqual(h, code)
  assert.ok(!h.includes(code), 'код не должен быть виден в хеше')
  assert.match(h, /^[0-9a-f]{64}$/)
})

test('один код для разных адресов даёт разные хеши', () => {
  assert.notEqual(hashCode('a@ithona.tj', '123456'), hashCode('b@ithona.tj', '123456'))
})

test('код сверяется без учёта регистра адреса и пробелов', () => {
  const h = hashCode('ivan@ithona.tj', '123456')
  assert.equal(codeMatches('IVAN@ithona.tj', '123456', h), true)
  assert.equal(codeMatches('  ivan@ithona.tj  ', ' 123456 ', h), true)
})

test('чужой код не подходит', () => {
  const h = hashCode('ivan@ithona.tj', '123456')
  assert.equal(codeMatches('ivan@ithona.tj', '123457', h), false)
  assert.equal(codeMatches('other@ithona.tj', '123456', h), false)
})

// ——— Проверка записи ———

const row = (over: Record<string, unknown> = {}) => ({
  email: 'ivan@ithona.tj',
  code_hash: hashCode('ivan@ithona.tj', '123456'),
  attempts: 0,
  expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  created_at: new Date().toISOString(),
  ...over,
})

test('верный код принимается', () => {
  assert.deepEqual(checkStoredCode(row(), 'ivan@ithona.tj', '123456'), { ok: true })
})

test('без запроса кода регистрация невозможна', () => {
  assert.equal(checkStoredCode(null, 'ivan@ithona.tj', '123456').error, 'code_not_requested')
})

test('истёкший код отклоняется', () => {
  const expired = row({ expires_at: new Date(Date.now() - 1000).toISOString() })
  assert.equal(checkStoredCode(expired, 'ivan@ithona.tj', '123456').error, 'code_expired')
})

test('после исчерпания попыток код отклоняется даже верный', () => {
  const blocked = row({ attempts: MAX_ATTEMPTS })
  assert.equal(checkStoredCode(blocked, 'ivan@ithona.tj', '123456').error, 'too_many_attempts')
})

test('неверный код отклоняется', () => {
  assert.equal(checkStoredCode(row(), 'ivan@ithona.tj', '000000').error, 'invalid_code')
})

test('код одного адреса не подходит другому', () => {
  assert.equal(checkStoredCode(row(), 'petr@ithona.tj', '123456').error, 'invalid_code')
})

test('подбор кода ограничен: 5 попыток — примерно 0,005% пространства', () => {
  // Шестизначный код — миллион вариантов; лимит попыток делает перебор бессмысленным.
  assert.ok(MAX_ATTEMPTS <= 10)
})

// ——— Повторная отправка ———

test('повторная отправка сразу после письма запрещена', () => {
  const fresh = row({ created_at: new Date().toISOString() })
  assert.equal(canResend(fresh), false)
  assert.ok(resendWaitSeconds(fresh) > 0)
})

test('после паузы повторная отправка разрешена', () => {
  const old = row({ created_at: new Date(Date.now() - RESEND_COOLDOWN_MS - 1000).toISOString() })
  assert.equal(canResend(old), true)
  assert.equal(resendWaitSeconds(old), 0)
})

test('если кода ещё не было — отправка разрешена', () => {
  assert.equal(canResend(null), true)
})

// ——— Письмо ———

test('в письме есть код, срок и название системы', () => {
  const m = buildVerificationMessage('482913', 15)
  assert.ok(m.subject.includes('482913'))
  assert.ok(m.text.includes('482913'))
  assert.ok(m.html.includes('482913'))
  assert.ok(m.text.includes('15 минут'))
  assert.ok(m.text.includes('CORE'))
})

test('письмо не содержит внешних картинок и скриптов', () => {
  const m = buildVerificationMessage('482913', 15)
  assert.equal(/<img|<script|http:\/\/|https:\/\//.test(m.html), false)
})

// ——— Настоящая отправка через SMTP ———

/** Минимальный SMTP-сервер: принимает письмо и возвращает полученные данные. */
function fakeSmtpServer() {
  const received: { from: string; to: string[]; data: string } = { from: '', to: [], data: '' }
  let collecting = false
  const server = net.createServer((socket) => {
    socket.write('220 test.local ESMTP\r\n')
    socket.on('data', (chunk) => {
      for (const line of chunk.toString('utf8').split('\r\n')) {
        if (collecting) {
          if (line === '.') {
            collecting = false
            socket.write('250 OK\r\n')
          } else {
            received.data += line + '\n'
          }
          continue
        }
        if (!line) continue
        const cmd = line.toUpperCase()
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) socket.write('250-test.local\r\n250 AUTH PLAIN LOGIN\r\n')
        else if (cmd.startsWith('AUTH')) socket.write('235 OK\r\n')
        else if (cmd.startsWith('MAIL FROM')) {
          received.from = line
          socket.write('250 OK\r\n')
        } else if (cmd.startsWith('RCPT TO')) {
          received.to.push(line)
          socket.write('250 OK\r\n')
        } else if (cmd === 'DATA') {
          collecting = true
          socket.write('354 End with .\r\n')
        } else if (cmd === 'QUIT') {
          socket.write('221 Bye\r\n')
          socket.end()
        } else socket.write('250 OK\r\n')
      }
    })
    socket.on('error', () => {})
  })
  return { server, received }
}

test('письмо действительно уходит по SMTP и содержит код', async () => {
  const { server, received } = fakeSmtpServer()
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()))
  const port = (server.address() as net.AddressInfo).port

  // Модуль читает настройки при импорте — подставляем окружение и импортируем заново.
  process.env.SMTP_HOST = '127.0.0.1'
  process.env.SMTP_PORT = String(port)
  process.env.SMTP_SECURE = 'false'
  process.env.SMTP_FROM = 'CORE <noreply@ithona.tj>'
  const mailer = await import(`../../api/mailer.js?smtp=${port}`)

  assert.equal(mailer.mailerEnabled(), true, 'отправка должна быть включена при заданном SMTP_HOST')
  await mailer.sendVerificationCode('ivan@ithona.tj', '482913', CODE_TTL_MS)

  assert.ok(received.from.includes('noreply@ithona.tj'), `отправитель: ${received.from}`)
  assert.ok(received.to.join(' ').includes('ivan@ithona.tj'), `получатель: ${received.to.join(' ')}`)
  assert.ok(received.data.includes('482913') || /482913/.test(Buffer.from(received.data, 'base64').toString()),
    'код должен присутствовать в теле письма')

  await new Promise<void>((res) => server.close(() => res()))
})

test('без SMTP_HOST отправка выключена (регистрация по коду-приглашению)', async () => {
  delete process.env.SMTP_HOST
  const mailer = await import('../../api/mailer.js?nohost=1')
  assert.equal(mailer.mailerEnabled(), false)
})
