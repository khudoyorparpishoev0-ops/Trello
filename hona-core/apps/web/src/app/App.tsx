import { Outlet } from 'react-router-dom'
import { CoreTile, CoreWordmark } from '../components/ui'

/**
 * Оболочка приложения. Навигация по разделам (My Day, задачи, проекты…) появится
 * вместе с разделами; Phase 1 — только экран состояния.
 */
export function App() {
  return (
    <div className="flex min-h-full flex-col bg-page text-fg">
      <header className="flex items-center gap-3 bg-sidebar px-6 py-4">
        <CoreTile size={40} />
        <CoreWordmark tone="onDark" />
        <span className="mono-label ml-auto text-sidebar-muted">2.0 · foundation</span>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
