import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Единое «сейчас» для всего экрана. Один интервал на приложение (спец §4.5):
 * обновляется раз в 30 000 мс, все таймеры/обратные отсчёты — производные.
 */
const NowContext = createContext<number>(Date.now())

export function NowProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNow(): number {
  return useContext(NowContext)
}
