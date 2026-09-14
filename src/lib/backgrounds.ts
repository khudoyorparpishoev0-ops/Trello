import type { CSSProperties } from 'react'

/** Готовые фоны досок (CSS-градиенты, хорошо смотрятся под непрозрачными колонками). */
export interface BgPreset {
  id: string
  label: string
  css: string
}

/**
 * Готовые фоны досок. Все тона — из палитры брендбука (зелёная шкала плюс
 * четыре статусных), градиенты идут под 150° — это ось семейства 30°/60°,
 * единственных допустимых наклонов. Произвольных оттенков в наборе нет.
 */
export const BG_PRESETS: BgPreset[] = [
  { id: 'ink', label: 'Тёмный', css: '#0B120E' },
  { id: 'graphite', label: 'Графит', css: 'linear-gradient(150deg,#101613,#26332B)' },
  { id: 'forest', label: 'Хвоя', css: 'linear-gradient(150deg,#0E3B21,#186B36)' },
  { id: 'green', label: 'Зелёный', css: 'linear-gradient(150deg,#186B36,#22A74E)' },
  { id: 'sage', label: 'Шалфей', css: 'linear-gradient(150deg,#B7D6C2,#DCEAE1)' },
  { id: 'mist', label: 'Светлый', css: '#F5F7F5' },
  { id: 'info', label: 'Синий', css: 'linear-gradient(150deg,#23539F,#2E6FD9)' },
  { id: 'warn', label: 'Охра', css: 'linear-gradient(150deg,#7A5510,#E0A126)' },
  { id: 'err', label: 'Кирпич', css: 'linear-gradient(150deg,#8E2A20,#B8382C)' },
  { id: 'deep', label: 'Глубокий', css: 'linear-gradient(150deg,#0E3B21,#0B120E)' },
]

/** Стиль фона для контейнера доски. Картинка (data-URL/http) → cover; иначе — как есть. */
export function boardBgStyle(bg?: string): CSSProperties | undefined {
  if (!bg) return undefined
  if (bg.startsWith('data:image') || bg.startsWith('http')) {
    return {
      backgroundImage: `url("${bg}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return { background: bg }
}

/** Сжать выбранную картинку до ширины ≤1600px (JPEG) и вернуть data-URL. */
export function imageToBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxW = 1600
      const scale = Math.min(1, maxW / img.width)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no-ctx'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load-error'))
    }
    img.src = url
  })
}
