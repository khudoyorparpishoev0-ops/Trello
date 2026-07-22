import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { TopBar } from '@/components/layout/TopBar'
import { Board, type Filters } from '@/components/board/Board'
import { CardDetailDrawer } from '@/components/board/CardDetailDrawer'

export default function App() {
  const [filters, setFilters] = useState<Filters>({ query: '', onlyMine: false, overdue: false })
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-fg">
      <Sidebar />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar filters={filters} onFiltersChange={setFilters} onMenuClick={() => setNavOpen(true)} />
        <main className="min-h-0 flex-1">
          <Board filters={filters} onOpenCard={setOpenCardId} />
        </main>
      </div>
      <CardDetailDrawer cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </div>
  )
}
