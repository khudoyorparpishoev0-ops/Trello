import type { CSSProperties } from 'react'

/** Готовые фоны досок (CSS-градиенты, хорошо смотрятся под непрозрачными колонками). */
export interface BgPreset {
  id: string
  label: string
  css: string
}

export const BG_PRESETS: BgPreset[] = [
  { id: 'emerald', label: 'Изумруд', css: 'linear-gradient(135deg,#065f46,#10b981)' },
  { id: 'ocean', label: 'Океан', css: 'linear-gradient(135deg,#0c4a6e,#0ea5e9)' },
  { id: 'indigo', label: 'Индиго', css: 'linear-gradient(135deg,#312e81,#6366f1)' },
  { id: 'sunset', label: 'Закат', css: 'linear-gradient(135deg,#7c2d12,#f59e0b)' },
  { id: 'plum', label: 'Слива', css: 'linear-gradient(135deg,#4a1d4a,#c026d3)' },
  { id: 'rose', label: 'Роза', css: 'linear-gradient(135deg,#831843,#ec4899)' },
  { id: 'teal', label: 'Бирюза', css: 'linear-gradient(135deg,#134e4a,#14b8a6)' },
  { id: 'night', label: 'Ночь', css: 'linear-gradient(135deg,#020617,#1e293b)' },
  { id: 'cherry', label: 'Вишня', css: 'linear-gradient(135deg,#7f1d1d,#ef4444)' },
  { id: 'aurora', label: 'Аврора', css: 'linear-gradient(135deg,#6366f1,#ec4899,#f59e0b)' },
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
