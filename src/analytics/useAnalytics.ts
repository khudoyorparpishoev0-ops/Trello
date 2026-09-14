/**
 * Доступ экранов к слою аналитики.
 *
 * Хук намеренно лежит отдельно от бочки `@/analytics`: сам слой не должен
 * зависеть от React и от хранилища, иначе его нельзя будет считать ни в тестах,
 * ни на сервере. Здесь только связка «состояние + сейчас → индекс».
 */
import { useMemo } from 'react'
import { useBoard } from '@/store/boardStore'
import { useNow } from '@/store/now'
import { analyze } from './analyze'
import type { AnalyticsIndex } from './types'

/** Индекс аналитики по всему пространству, пересчитывается с тиком «сейчас». */
export function useAnalytics(): AnalyticsIndex {
  const { data } = useBoard()
  const now = useNow()
  return useMemo(() => analyze(data, new Date(now)), [data, now])
}
