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

/** Логин из ФИО: транслит фамилии (первого слова), только a-z0-9. */
export function loginFromName(fio: string): string {
  const first = fio.trim().split(/\s+/)[0] ?? ''
  return translit(first).replace(/[^a-z0-9]/g, '')
}
