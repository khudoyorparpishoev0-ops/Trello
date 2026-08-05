import { useState } from 'react'
import { Sidebar, type AppView } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { TopBar } from '@/components/layout/TopBar'
import { Board, type Filters } from '@/components/board/Board'
import { CardDetailDrawer } from '@/components/board/CardDetailDrawer'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { Company } from '@/components/company/Company'
import { Calendar } from '@/components/calendar/Calendar'
import { Reports } from '@/components/reports/Reports'
import { Team } from '@/components/team/Team'
import { Settings } from '@/components/settings/Settings'

export default function App() {
  const [view, setView] = useState<AppView>('board')
  const [filters, setFilters] = useState<Filters>({ query: '', onlyMine: false, overdue: false })
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-fg">
      <Sidebar activeView={view} onSelectView={setView} />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} activeView={view} onSelectView={setView} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
        {view === 'board' && (
          <>
            <TopBar filters={filters} onFiltersChange={setFilters} onMenuClick={() => setNavOpen(true)} />
            <main className="min-h-0 flex-1">
              <Board filters={filters} onOpenCard={setOpenCardId} />
            </main>
          </>
        )}
        {view === 'dashboard' && <Dashboard onMenuClick={() => setNavOpen(true)} onOpenCard={setOpenCardId} />}
        {view === 'company' && (
          <Company onMenuClick={() => setNavOpen(true)} onNavigateBoard={() => setView('board')} />
        )}
        {view === 'calendar' && (
          <Calendar
            onMenuClick={() => setNavOpen(true)}
            onOpenCard={setOpenCardId}
            onNavigateBoard={() => setView('board')}
          />
        )}
        {view === 'reports' && (
          <Reports onMenuClick={() => setNavOpen(true)} onOpenCard={setOpenCardId} />
        )}
        {view === 'team' && <Team onMenuClick={() => setNavOpen(true)} />}
        {view === 'profile' && <Settings onMenuClick={() => setNavOpen(true)} />}
      </div>
      <MobileTabBar
        activeView={view}
        onlyMine={filters.onlyMine}
        onDashboard={() => setView('dashboard')}
        onBoard={() => {
          setView('board')
          setFilters((f) => ({ ...f, onlyMine: false }))
        }}
        onTasks={() => {
          setView('board')
          setFilters((f) => ({ ...f, onlyMine: true }))
        }}
        onCalendar={() => setView('calendar')}
        onMore={() => setNavOpen(true)}
      />
      <CardDetailDrawer cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </div>
  )
}
