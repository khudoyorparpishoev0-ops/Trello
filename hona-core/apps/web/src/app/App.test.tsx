// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, renderApp } from '../../test/render'

/** §23.8 Web: оболочка рендерится; экран состояния показывает ответы health (fetch замокан). */
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function serve(health: Response | Error, ready: Response | Error) {
  fetchMock.mockImplementation(async (input) => {
    const url = requestUrl(input)
    const answer = url.endsWith('/api/v1/health') ? health : ready
    if (answer instanceof Error) throw answer
    return answer.clone()
  })
}

describe('application shell', () => {
  it('renders the IT-HONA CORE shell and the status page', async () => {
    serve(
      jsonResponse(200, { status: 'ok', version: '0.1.0', uptimeS: 5 }),
      jsonResponse(200, { status: 'ok' }),
    )
    renderApp('/')
    expect(screen.getByText('IT-HONA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Состояние системы' })).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('API-status').textContent).toBe('ok'))
  })

  it('shows 404 for unknown routes inside the shell', () => {
    serve(jsonResponse(200, {}), jsonResponse(200, {}))
    renderApp('/nowhere')
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeTruthy()
  })
})

describe('status page', () => {
  it('shows "ok" for liveness and readiness', async () => {
    serve(
      jsonResponse(200, { status: 'ok', version: '0.1.0', uptimeS: 42 }),
      jsonResponse(200, { status: 'ok' }),
    )
    renderApp()
    await waitFor(() => expect(screen.getByTestId('Зависимости-status').textContent).toBe('ok'))
    expect(screen.getByTestId('API-status').textContent).toBe('ok')
    expect(screen.getByText(/версия 0\.1\.0, аптайм 42 с/)).toBeTruthy()
  })

  it('shows "unavailable" when readiness answers 503', async () => {
    serve(
      jsonResponse(200, { status: 'ok', version: '0.1.0', uptimeS: 1 }),
      jsonResponse(503, { status: 'unavailable' }),
    )
    renderApp()
    await waitFor(() =>
      expect(screen.getByTestId('Зависимости-status').textContent).toBe('unavailable'),
    )
  })

  it('shows an error when the API is unreachable and never invents data', async () => {
    serve(new TypeError('Failed to fetch'), new TypeError('Failed to fetch'))
    renderApp()
    await waitFor(() => expect(screen.getByTestId('API-status').textContent).toBe('недоступен'))
    expect(screen.getByTestId('Зависимости-status').textContent).toBe('недоступен')
    expect(screen.getByText('версия —')).toBeTruthy()
  })

  it('page load issues only GET requests — no writes, no seed fallback (v1 defects 1–2)', async () => {
    serve(
      jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } }),
      jsonResponse(503, { status: 'unavailable' }),
    )
    renderApp()
    await waitFor(() => expect(screen.getByTestId('API-status').textContent).toBe('недоступен'))
    expect(fetchMock).toHaveBeenCalled()
    for (const [, init] of fetchMock.mock.calls) expect(init?.method ?? 'GET').toBe('GET')
    expect(fetchMock.mock.calls.map(([input]) => requestUrl(input)).sort()).toEqual([
      '/api/v1/health',
      '/api/v1/health/ready',
    ])
  })
})
