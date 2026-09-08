import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { TopBar } from '@/components/layout/TopBar'
import { SaveStatusBanner } from '@/components/layout/SaveStatusBanner'
import { Board, type Filters } from '@/components/board/Board'
import { TableView } from '@/components/board/TableView'
import { Timeline } from '@/components/board/Timeline'
import { CardDetailDrawer } from '@/components/board/CardDetailDrawer'
import { StickerMenuProvider } from '@/components/board/StickerMenu'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { Company } from '@/components/company/Company'
import { Calendar } from '@/components/calendar/Calendar'
import { Reports } from '@/components/reports/Reports'
import { Team } from '@/components/team/Team'
import { Settings } from '@/components/settings/Settings'
import { useBoard } from '@/store/boardStore'
import { useRouter } from '@/store/router'

export default function App() {
  const { route, navigate } = useRouter()
  const [filters, setFilters] = useState<Filters>({ query: '', onlyMine: false, overdue: false })
  const [navOpen, setNavOpen] = useState(false)

  useBoardRouteSync()

  const openCard = (cardId: string) => navigate({ cardId })
  const view = route.view

  return (
    <StickerMenuProvider>
      <div className="flex h-screen w-full overflow-hidden bg-page text-fg">
        <Sidebar />
        <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">
          {/* Состояние сохранения касается всех экранов, поэтому плашка живёт в каркасе */}
          <SaveStatusBanner />
          {view === 'board' && (
            <>
              <TopBar filters={filters} onFiltersChange={setFilters} onMenuClick={() => setNavOpen(true)} />
              <main className="min-h-0 flex-1">
                {route.boardView === 'board' && <Board filters={filters} onOpenCard={openCard} />}
                {route.boardView === 'timeline' && <Timeline filters={filters} onOpenCard={openCard} />}
                {route.boardView === 'table' && <TableView filters={filters} onOpenCard={openCard} />}
              </main>
            </>
          )}
          {view === 'dashboard' && <Dashboard onMenuClick={() => setNavOpen(true)} onOpenCard={openCard} />}
          {view === 'company' && (
            <Company onMenuClick={() => setNavOpen(true)} onNavigateBoard={() => navigate({ view: 'board' })} />
          )}
          {view === 'calendar' && (
            <Calendar
              onMenuClick={() => setNavOpen(true)}
              onOpenCard={openCard}
              onNavigateBoard={() => navigate({ view: 'board' })}
            />
          )}
          {view === 'reports' && <Reports onMenuClick={() => setNavOpen(true)} onOpenCard={openCard} />}
          {view === 'team' && <Team onMenuClick={() => setNavOpen(true)} />}
          {view === 'profile' && <Settings onMenuClick={() => setNavOpen(true)} />}
        </div>
        <MobileTabBar
          onlyMine={filters.onlyMine}
          onToggleOnlyMine={(onlyMine) => setFilters((f) => ({ ...f, onlyMine }))}
          onMore={() => setNavOpen(true)}
        />
        <CardDetailDrawer cardId={route.cardId} onClose={() => navigate({ cardId: null })} />
      </div>
    </StickerMenuProvider>
  )
}

/**
 * Синхронизация адреса и открытой доски.
 *
 * Источник истины — адрес: доска в нём называется явно, поэтому ссылку можно
 * отправить коллеге. Стор об адресе не знает, и связывать их приходится здесь.
 */
function useBoardRouteSync() {
  const { route, navigate } = useRouter()
  const { boards, archivedBoards, activeBoardId, actions, state, boardIdOfCard } = useBoard()

  // Раздел «Доска»: подставляем доску из адреса, а неизвестную заменяем
  // активной — так ссылка на удалённый проект не оставляет пустой экран.
  useEffect(() => {
    if (route.view !== 'board' || !activeBoardId) return
    const known = [...boards, ...archivedBoards].some((b) => b.id === route.boardId)
    if (known) {
      if (route.boardId !== activeBoardId) actions.switchBoard(route.boardId!)
    } else {
      navigate({ boardId: activeBoardId }, { replace: true })
    }
  }, [route.view, route.boardId, boards, archivedBoards, activeBoardId, actions, navigate])

  // Ссылка на карточку может указывать на задачу с другой доски — открываем ту.
  useEffect(() => {
    if (!route.cardId || state.cards[route.cardId]) return
    const boardId = boardIdOfCard(route.cardId)
    if (boardId && boardId !== activeBoardId) actions.switchBoard(boardId)
  }, [route.cardId, state.cards, boardIdOfCard, activeBoardId, actions])
}
