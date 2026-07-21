import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from '@/store/theme'
import { BoardProvider } from '@/store/boardStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BoardProvider>
        <App />
      </BoardProvider>
    </ThemeProvider>
  </StrictMode>,
)
