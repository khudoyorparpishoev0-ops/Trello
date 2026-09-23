import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './app/providers'
import { createRouter } from './app/router'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root element is missing')

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={createRouter()} />
    </Providers>
  </StrictMode>,
)
