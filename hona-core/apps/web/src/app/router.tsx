import { createBrowserRouter } from 'react-router-dom'
import { NotFoundPage } from '../pages/NotFound'
import { StatusPage } from '../pages/Status'
import { App } from './App'

export const routes = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <StatusPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes)
}
