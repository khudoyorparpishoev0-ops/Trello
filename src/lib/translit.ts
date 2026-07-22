/**
 * Транслитерация кириллицы (рус. + узб.) в латиницу для генерации логина из ФИО.
 * Пример: «Парпишоев Худоёр» → «parpishoev».
 */
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Узбекская кириллица
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
}

function translit(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => {
      if (ch in MAP) return MAP[ch]
      if (/[a-z0-9]/.test(ch)) return ch
      return ''
    })
    .join('')
}

/**
 * Логин из Ф.И.О: транслит имени (2-е слово, иначе первое),
 * с заглавной первой буквой. «Парпишоев Худоёр» → «Khudoyor».
 */
export function loginFromName(fio: string): string {
  const parts = fio.trim().split(/\s+/)
  const imya = parts[1] || parts[0] || '' // Имя — второе слово Ф.И.О
  const t = translit(imya).replace(/[^a-z0-9]/g, '')
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}
