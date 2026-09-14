import { useEffect, useState } from 'react'

/** Телефон — ширина меньше первой контрольной точки Tailwind (sm, 640px). */
const QUERY = '(max-width: 639px)'

/**
 * Узкий экран телефона. Нужен там, где раскладку нельзя переключить одним
 * CSS: на доске телефон получает не горизонтальный скролл колонок, а ряд
 * чипов-списков и одну колонку во всю ширину.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setPhone(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return phone
}
