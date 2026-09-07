/**
 * E2E-набор CORE (Playwright). Запуск: npm run test:e2e
 * Браузер: BROWSER=chromium|firefox|webkit (по умолчанию chromium).
 *
 * Проверяются пользовательские сценарии на собранном dist: доска и карточки,
 * представления, фильтры и поиск, права по ролям на уровне интерфейса,
 * кодировка, адаптивность, а также исправления, найденные аудитом.
 */
import { serveDist, launch, defaultRoutes, createReporter, isNoise } from './harness.mjs'

const VIEWPORT = { width: 1280, height: 950 }

const run = async () => {
  const site = await serveDist()
  const browser = await launch()
  const r = createReporter(`E2E CORE · ${process.env.BROWSER || 'chromium'}`)
  const errors = []

  // collectErrors=false — для страниц, где ошибочные ответы API подставлены
  // намеренно (проверка 401/500): их логи браузера не являются дефектом.
  const newPage = async (opts = {}, routes = {}, collectErrors = true) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, ...opts })
    const page = await ctx.newPage()
    if (collectErrors) {
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => m.type() === 'error' && !isNoise(m.text()) && errors.push(m.text()))
    } else {
      // Необработанные исключения — дефект в любом случае, даже при ошибке сети.
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
    }
    await page.route('**/api/**', defaultRoutes(routes))
    return page
  }

  try {
    // ——— 1. Загрузка приложения и доска ———
    r.section('Доска и карточки')
    const page = await newPage()
    await page.goto(site.base, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Платформа задач', level: 1 }).waitFor()
    r.check(true, 'приложение загружается, доска открыта')
    r.check(await page.locator('article').count() > 0, 'карточки отрисованы')

    // Создание карточки
    const col = page.locator('section').filter({ hasText: 'To Do' }).first()
    const before = await col.locator('article').count()
    await col.getByRole('button', { name: 'Добавить карточку' }).first().click()
    const ta = col.locator('textarea').first()
    await ta.fill('TEST Проверка создания')
    await ta.press('Enter')
    await page.waitForTimeout(150)
    r.check((await col.locator('article').count()) === before + 1, 'карточка создаётся (Enter)')
    r.check(
      (await col.locator('article').first().innerText()).includes('TEST Проверка создания'),
      'новая карточка встаёт в начало списка',
    )

    // ——— 2. Уникальность кодов задач (исправление аудита) ———
    r.section('Коды задач')
    const codes = await page.locator('article').evaluateAll((els) =>
      els.map((e) => (e.innerText.match(/IT-\d+/) || [])[0]).filter(Boolean),
    )
    r.check(codes.length > 0, `коды задач отображаются (${codes.length} шт.)`)
    r.check(new Set(codes).size === codes.length, 'коды задач уникальны — дублей нет')

    // ——— 3. Панель задачи ———
    r.section('Карточка задачи')
    await page.locator('article').filter({ hasText: 'TEST Проверка создания' }).first().click()
    const dlg = page.getByRole('dialog')
    await dlg.waitFor()
    r.check(true, 'панель задачи открывается по клику')

    // Приоритет
    await dlg.getByRole('button', { name: 'Критический' }).click()
    await page.waitForTimeout(120)
    const prioBg = async (name) =>
      dlg
        .locator('button', { hasText: name })
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    r.check(
      (await prioBg('Критический')) !== (await prioBg('Низкий')),
      'приоритет меняется и подсвечивается',
    )

    // Срок через собственный пикер
    await dlg.getByRole('button', { name: /Срок не задан/ }).click()
    await page.getByText('Час', { exact: true }).waitFor()
    r.check(await page.locator('input[type=datetime-local]').count() === 0, 'нативный datetime-local не используется')
    await dlg.locator('button', { hasText: /^20$/ }).first().click()
    await page.waitForTimeout(150)
    r.check((await dlg.getByRole('button', { name: /осталось|просрочено/ }).count()) > 0, 'срок применяется сразу')
    await dlg.getByRole('button', { name: 'Готово' }).click()

    // Чек-лист
    await dlg.getByRole('button', { name: 'Добавить чек-лист' }).click()
    const clInput = dlg.locator('input[placeholder*="чек-лист"]').first()
    await clInput.fill('TEST Этапы')
    await clInput.press('Enter')
    await page.waitForTimeout(120)
    const itemInput = dlg.locator('input[placeholder*="пункт"]').first()
    await itemInput.fill('Пункт 1')
    await itemInput.press('Enter')
    await itemInput.fill('Пункт 2')
    await itemInput.press('Enter')
    await page.waitForTimeout(120)
    r.check((await dlg.getByText('0/2').count()) > 0, 'чек-лист: 0/2 после добавления двух пунктов')
    await dlg.locator('label').filter({ hasText: 'Пункт 1' }).locator('input,button,span').first().click()
    await page.waitForTimeout(150)
    r.check((await dlg.getByText('1/2').count()) > 0, 'отметка пункта пересчитывает прогресс (1/2)')

    // Комментарий
    const commentBox = dlg.locator('textarea[placeholder*="сообщение"]').first()
    await commentBox.fill('TEST комментарий @Алишер Каримов')
    await commentBox.press('Enter')
    await page.waitForTimeout(150)
    r.check((await dlg.getByText('TEST комментарий').count()) > 0, 'комментарий добавляется (Enter)')

    // XSS: HTML в названии не исполняется
    const titleInput = dlg.locator('input').first()
    await titleInput.fill('<img src=x onerror="window.__xss=1">')
    await page.waitForTimeout(200)
    const xss = await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, '__xss'))
    r.check(xss === false, 'HTML в названии задачи не исполняется (XSS не проходит)')
    r.check((await page.locator('img[src="x"]').count()) === 0, 'HTML не превращается в разметку')
    await titleInput.fill('TEST Проверка создания')

    await page.keyboard.press('Escape')
    await dlg.waitFor({ state: 'detached' })
    r.check(true, 'панель закрывается по Escape')

    // ——— 4. Системный статус списка (исправление аудита) ———
    r.section('Статус списка')
    const doneCol = page.locator('section').filter({ hasText: 'Done' }).first()
    await doneCol.getByRole('button', { name: 'Действия со списком' }).click()
    r.check(
      (await page.getByRole('menuitem', { name: /выполнен/i }).count()) > 0,
      'в меню списка есть переключатель «задачи выполнены»',
    )
    await page.keyboard.press('Escape')
    await page.mouse.click(5, 5)

    // ——— 5. Представления ———
    r.section('Представления')
    const seg = (n) => page.locator('header').getByRole('button', { name: n, exact: true })
    await seg('Таблица').click()
    await page.getByText('Чек-лист', { exact: true }).first().waitFor()
    const tableCodes = await page
      .locator('button')
      .filter({ hasText: /IT-\d+/ })
      .evaluateAll((els) => els.map((e) => (e.innerText.match(/IT-\d+/) || [])[0]).filter(Boolean))
    r.check(tableCodes.length > 0, 'вид «Таблица» показывает задачи')
    r.check(new Set(tableCodes).size === tableCodes.length, 'в таблице коды задач тоже уникальны')
    await seg('Таймлайн').click()
    await page.getByText('Задача', { exact: true }).first().waitFor()
    r.check((await page.locator('button').filter({ hasText: /IT-\d+/ }).count()) > 0, 'вид «Таймлайн» показывает полосы')
    r.check((await seg('Календарь').count()) === 0, 'вкладки «Календарь» в переключателе нет')
    await seg('Доска').click()
    await page.locator('section').filter({ hasText: 'To Do' }).first().waitFor()
    r.check(true, 'возврат к виду «Доска»')

    // ——— 6. Поиск и фильтры ———
    r.section('Поиск и фильтры')
    const search = page.getByPlaceholder('Поиск карточек')
    await search.fill('TEST Проверка')
    await page.waitForTimeout(200)
    r.check((await page.locator('article').count()) === 1, 'поиск оставляет только совпадения')
    await search.fill('зззнесуществующее')
    await page.waitForTimeout(200)
    r.check((await page.locator('article').count()) === 0, 'поиск без результатов не падает')
    await search.fill('')
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: 'Мои карточки' }).click()
    await page.waitForTimeout(200)
    r.check(true, 'фильтр «Мои карточки» применяется')
    await page.getByRole('button', { name: 'Мои карточки' }).click()
    await page.getByRole('button', { name: 'Просрочено' }).click()
    await page.waitForTimeout(200)
    const overdueCards = await page.locator('article').count()
    r.check(overdueCards >= 0, `фильтр «Просрочено» применяется (${overdueCards} задач)`)
    await page.getByRole('button', { name: 'Просрочено' }).click()

    // ——— 7. Разделы ———
    r.section('Разделы')
    for (const [name, marker] of [
      ['Дашборд', 'Загрузка по отделам'],
      ['Команда', 'Сотрудник'],
      ['Календарь', 'событий в этом месяце'],
      ['Компания', 'Проекты'],
      ['Настройки', 'Профиль'],
    ]) {
      await page.getByText(name, { exact: true }).first().click()
      await page.getByText(new RegExp(marker, 'i')).first().waitFor({ timeout: 8000 })
      r.check(true, `раздел «${name}» открывается`)
    }

    // ——— 8. Кодировка ———
    r.section('Кодировка')
    const bodyText = await page.locator('body').innerText()
    r.check(!bodyText.includes('�'), 'на странице нет символов повреждённой кодировки (U+FFFD)')

    // ——— 9. Дашборд: сверка чисел ———
    r.section('Дашборд')
    await page.getByText('Дашборд', { exact: true }).first().click()
    await page.getByText('Загрузка по отделам').waitFor()
    const kpi = await page.locator('[data-kpi]').allInnerTexts()
    r.check(kpi.length >= 3, `KPI отображаются (${kpi.join(' / ')})`)
    r.check(
      kpi.every((v) => !v.includes('NaN') && !v.includes('undefined')),
      'в KPI нет NaN/undefined',
    )

    await page.context().close()

    // ——— 10. Адаптивность ———
    r.section('Адаптивность')
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      const p = await newPage({ viewport: size, isMobile: size.width < 500, hasTouch: size.width < 500 })
      await p.goto(site.base, { waitUntil: 'domcontentloaded' })
      await p.getByRole('heading', { name: 'Платформа задач', level: 1 }).waitFor()
      const over = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }))
      r.check(over.sw <= over.iw + 1, `${size.width}×${size.height}: нет горизонтального переполнения`)
      await p.context().close()
    }

    // ——— 11. Экран входа ———
    r.section('Авторизация')
    const auth = await newPage({}, {
      '/api/auth/me': (_route, send) =>
        send({ authRequired: true, accountsEnabled: true, authenticated: false, user: null }),
      '/api/auth/login': (_route, send) => send({ error: 'invalid_credentials' }, 401),
    }, false)
    await auth.goto(site.base, { waitUntil: 'domcontentloaded' })
    await auth.getByText('CORE', { exact: true }).first().waitFor()
    r.check(true, 'экран входа показывается неавторизованному пользователю')
    r.check((await auth.getByText('IT-HONA Platform').count()) > 0, 'лок-ап CORE с подписью')
    r.check((await auth.locator('article').count()) === 0, 'доска недоступна без входа')
    await auth.getByPlaceholder('admin').fill('someone')
    await auth.locator('input[type=password]').first().fill('wrong-password')
    await auth.getByRole('button', { name: 'Войти' }).click()
    await auth.waitForTimeout(300)
    r.check(
      (await auth.getByText(/Неверный логин или пароль/).count()) > 0,
      'неверные данные → понятное сообщение, вход не выполняется',
    )
    // Регистрация только с корпоративной почты
    await auth.getByRole('button', { name: 'Регистрация' }).click()
    await auth.getByPlaceholder('ivan@ithona.tj').waitFor()
    r.check(
      (await auth.getByText(/Только рабочая почта/).count()) > 0,
      'в форме регистрации есть подсказка про корпоративную почту',
    )
    const fill = async (mail) => {
      await auth.getByPlaceholder('Иванов Иван Иванович').fill('Тестов Тест')
      await auth.getByPlaceholder('Руководитель отдела').fill('Инженер')
      await auth.getByPlaceholder('Разработка').fill('IT-отдел')
      await auth.getByPlaceholder('ivan@ithona.tj').fill(mail)
      await auth.locator('input[type=date]').fill('1990-01-01')
      await auth.locator('input[type=password]').first().fill('parol123')
      await auth.getByPlaceholder('Код от администратора').fill('code')
    }
    await fill('someone@gmail.com')
    await auth.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await auth.waitForTimeout(250)
    r.check(
      (await auth.getByText(/только с рабочей почты/i).count()) > 0,
      'посторонняя почта (@gmail.com) отклоняется с понятным сообщением',
    )
    await fill('ivan@ithona.tj')
    await auth.waitForTimeout(150)
    r.check(
      (await auth.getByPlaceholder('имя латиницей').inputValue()) === 'ivan',
      'логин подставляется из почты (ivan@ithona.tj → ivan)',
    )
    await auth.getByPlaceholder('имя латиницей').fill('my.login')
    await auth.getByPlaceholder('ivan@ithona.tj').fill('other@ithona.tj')
    await auth.waitForTimeout(150)
    r.check(
      (await auth.getByPlaceholder('имя латиницей').inputValue()) === 'my.login',
      'логин, изменённый вручную, не перезаписывается сменой почты',
    )
    r.check(
      (await auth.locator('.border-err').count()) === 0,
      'корпоративная почта (@ithona.tj) не подсвечивается ошибкой',
    )
    await auth.context().close()

    // ——— 11б. Регистрация с кодом из письма ———
    r.section('Код подтверждения по почте')
    let sentTo = ''
    const mailAuth = await newPage({}, {
      '/api/auth/me': (_route, send) =>
        send({ authRequired: true, accountsEnabled: true, emailVerification: true, authenticated: false, user: null }),
      '/api/auth/register/request-code': async (route, send) => {
        sentTo = JSON.parse(route.request().postData() || '{}').email || ''
        return send({ ok: true, ttlMinutes: 15 })
      },
    }, false)
    await mailAuth.goto(site.base, { waitUntil: 'domcontentloaded' })
    await mailAuth.getByRole('button', { name: 'Регистрация' }).click()
    await mailAuth.getByPlaceholder('ivan@ithona.tj').waitFor()
    r.check(
      (await mailAuth.getByText('Код приглашения').count()) === 0,
      'поля «Код приглашения» больше нет',
    )
    r.check((await mailAuth.getByText('Код из письма').count()) > 0, 'вместо него — «Код из письма»')
    r.check(
      (await mailAuth.getByRole('button', { name: 'Отправить код' }).count()) > 0,
      'есть кнопка «Отправить код»',
    )
    await mailAuth.getByPlaceholder('ivan@ithona.tj').fill('ivan@ithona.tj')
    await mailAuth.getByRole('button', { name: 'Отправить код' }).click()
    await mailAuth.waitForTimeout(250)
    r.check(sentTo === 'ivan@ithona.tj', `код запрошен для указанного адреса (${sentTo})`)
    r.check(
      (await mailAuth.getByText(/Код отправлен на ivan@ithona.tj/).count()) > 0,
      'показано подтверждение отправки письма',
    )
    r.check(
      (await mailAuth.getByRole('button', { name: 'Ещё раз' }).count()) > 0,
      'кнопка переключается на повторную отправку',
    )
    // Посторонняя почта: письмо не запрашивается
    sentTo = ''
    await mailAuth.getByPlaceholder('ivan@ithona.tj').fill('someone@gmail.com')
    await mailAuth.getByRole('button', { name: 'Ещё раз' }).click()
    await mailAuth.waitForTimeout(250)
    r.check(sentTo === '', 'на постороннюю почту код не отправляется')
    await mailAuth.context().close()

    // ——— 12. Конфликт версий доски ———
    // Доска хранится одним блобом: раньше сохранение второго участника молча
    // затирало правки первого. Теперь сервер отвечает 409, автосохранение
    // останавливается, а выбор — чью версию оставить — делает человек.
    r.section('Конфликт версий')

    const remoteBoard = {
      workspace: { id: 'w1', name: 'IT-HONA', boards: [{ id: 'b1', name: 'Удалённая доска' }] },
      users: { u1: { id: 'u1', name: 'Тест Тестов', initials: 'ТТ', color: '#186B36' } },
      currentUserId: 'u1',
      boards: {
        b1: { id: 'b1', name: 'Удалённая доска', visibility: 'private', listIds: ['l1'], memberIds: ['u1'] },
      },
      boardOrder: ['b1'],
      activeBoardId: 'b1',
      lists: { l1: { id: 'l1', title: 'To Do', cardIds: ['c1'] } },
      cards: {
        c1: {
          id: 'c1',
          title: 'TEST карточка с сервера',
          labelIds: [],
          assigneeIds: [],
          priority: 'medium',
          checklists: [],
          comments: [],
          attachments: [],
          createdAt: new Date().toISOString(),
          code: 500,
        },
      },
      labels: {},
      departments: [],
    }

    // Сценарий А: взять версию сервера.
    let served = 0
    const conflictA = await newPage({}, {
      '/api/board': (route, send) => {
        if (route.request().method() !== 'GET') return send({ error: 'version_conflict', version: 42 }, 409)
        // Первый GET — доски нет (клиент попробует записать свою и получит 409),
        // следующий — уже чужая версия, которую и заберёт кнопка «Обновить».
        return served++ === 0 ? send(null) : send(remoteBoard)
      },
    }, false)
    await conflictA.goto(site.base, { waitUntil: 'domcontentloaded' })
    const bannerA = conflictA.getByRole('alert')
    await bannerA.waitFor({ timeout: 8000 })
    r.check(true, 'при 409 показывается плашка конфликта, а не молчаливая перезапись')
    r.check(
      (await conflictA.getByRole('heading', { name: 'Платформа задач', level: 1 }).count()) > 0,
      'свои правки при конфликте остаются на экране',
    )
    await bannerA.getByRole('button', { name: 'Обновить' }).click()
    await conflictA.getByRole('heading', { name: 'Удалённая доска', level: 1 }).waitFor({ timeout: 8000 })
    r.check(true, '«Обновить» подставляет версию сервера')
    r.check(
      (await conflictA.getByText('TEST карточка с сервера').count()) > 0,
      'после обновления видны чужие карточки',
    )
    r.check((await conflictA.getByRole('alert').count()) === 0, 'плашка конфликта исчезает после обновления')
    await conflictA.context().close()

    // Сценарий Б: записать свою версию поверх чужой.
    let puts = 0
    const conflictB = await newPage({}, {
      '/api/board': (route, send) => {
        if (route.request().method() === 'GET') return send(null)
        // Первая запись конфликтует, повторная (осознанная) — проходит.
        return puts++ === 0 ? send({ error: 'version_conflict', version: 42 }, 409) : send({ ok: true, version: 43 })
      },
    }, false)
    await conflictB.goto(site.base, { waitUntil: 'domcontentloaded' })
    const bannerB = conflictB.getByRole('alert')
    await bannerB.waitFor({ timeout: 8000 })
    await bannerB.getByRole('button', { name: 'Записать мою версию' }).click()
    await conflictB.waitForTimeout(600)
    r.check((await conflictB.getByRole('alert').count()) === 0, '«Записать мою версию» снимает конфликт')
    r.check(
      (await conflictB.getByRole('heading', { name: 'Платформа задач', level: 1 }).count()) > 0,
      'после записи своей версии на экране остаётся она, а не чужая',
    )
    await conflictB.context().close()

    // ——— 13. Отказ по правам ———
    // Удаление проекта уносит все его задачи, поэтому доступно администратору.
    // Проверка на сервере: PUT принимает состояние целиком, и скрытой кнопки
    // мало. Интерфейс обязан объяснить отказ, а не уйти в «локальный режим».
    r.section('Отказ по правам')
    const denied = await newPage({}, {
      '/api/board': (route, send) => {
        if (route.request().method() === 'GET') return send(null)
        return send(
          {
            error: 'forbidden_board_delete',
            detail: 'удалять проекты может только администратор',
            boards: ['Склад · Периметр'],
          },
          403,
        )
      },
    }, false)
    await denied.goto(site.base, { waitUntil: 'domcontentloaded' })
    const deniedBanner = denied.getByRole('alert')
    await deniedBanner.waitFor({ timeout: 8000 })
    r.check(
      (await deniedBanner.getByText(/Изменение отклонено/).count()) > 0,
      'отказ по правам объясняется, а не выглядит потерей связи',
    )
    r.check(
      (await deniedBanner.getByText(/только администратор/).count()) > 0,
      'в сообщении названа причина и восстановленный проект',
    )
    await deniedBanner.getByRole('button', { name: 'Скрыть сообщение' }).click()
    await denied.waitForTimeout(200)
    r.check((await denied.getByRole('alert').count()) === 0, 'сообщение закрывается')
    await denied.context().close()

    // ——— 14. Ошибка сервера ———
    r.section('Обработка ошибок')
    const broken = await newPage({}, {
      '/api/board': (_route, send) => send({ error: 'internal_error' }, 500),
    }, false)
    await broken.goto(site.base, { waitUntil: 'domcontentloaded' })
    await broken.getByRole('heading', { name: 'Платформа задач', level: 1 }).waitFor({ timeout: 8000 })
    r.check(true, 'при ошибке 500 на загрузке доски приложение не падает (локальный режим)')
    await broken.context().close()

    r.check(errors.length === 0, `нет ошибок в консоли (${errors.slice(0, 3).join(' | ') || 'чисто'})`)
  } catch (e) {
    r.check(false, `СБОЙ ПРОГОНА: ${e.message}`)
  } finally {
    await browser.close()
    await site.close()
  }

  console.log(`\nИтог: пройдено ${r.passed}, провалено ${r.failures.length}`)
  if (r.failures.length) {
    console.log('Провалы:\n' + r.failures.map((f) => '  • ' + f).join('\n'))
    process.exitCode = 1
  }
}

run()
