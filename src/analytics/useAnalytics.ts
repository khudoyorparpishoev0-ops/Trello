/**
 * Доступ экранов к слою аналитики.
 *
 * Хук лежит на стороне интерфейса, а не в общем коде: слой аналитики не должен
 * зависеть ни от React, ни от хранилища — иначе его нельзя было бы считать ни в
 * тестах, ни на сервере. Здесь только связка «состояние + сейчас → индекс».
 */
import { useMemo } from 'react'
import { useBoard } from '@/store/boardStore'
import { useNow } from '@/store/now'
import { analyze } from '#shared/analytics'
import type { AnalyticsIndex } from '#shared/analytics'

/** Индекс аналитики по всему пространству, пересчитывается с тиком «сейчас». */
export function useAnalytics(): AnalyticsIndex {
  const { data } = useBoard()
  const now = useNow()
  return useMemo(() => analyze(data, new Date(now)), [data, now])
}
