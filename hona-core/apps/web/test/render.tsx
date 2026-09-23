import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Providers } from '../src/app/providers'
import { routes } from '../src/app/router'

/** Приложение целиком в памяти: без повторов запросов, чтобы ошибки видны сразу. */
export function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
