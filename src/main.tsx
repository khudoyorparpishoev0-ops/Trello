import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from '@/store/theme'
import { BoardProvider } from '@/store/boardStore'
import { AuthGate } from '@/store/auth'
import { NowProvider } from '@/store/now'
import { RouterProvider } from '@/store/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <NowProvider>
        <AuthGate>
          <BoardProvider>
            <RouterProvider>
              <App />
            </RouterProvider>
          </BoardProvider>
        </AuthGate>
      </NowProvider>
    </ThemeProvider>
  </StrictMode>,
)
