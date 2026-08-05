import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from '@/store/theme'
import { BoardProvider } from '@/store/boardStore'
import { AuthGate } from '@/store/auth'
import { NowProvider } from '@/store/now'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <NowProvider>
        <AuthGate>
          <BoardProvider>
            <App />
          </BoardProvider>
        </AuthGate>
      </NowProvider>
    </ThemeProvider>
  </StrictMode>,
)
