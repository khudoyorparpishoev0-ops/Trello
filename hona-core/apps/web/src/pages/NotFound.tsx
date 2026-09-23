import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="mx-auto w-full max-w-narrow px-6 py-10">
      <p className="mono-label text-muted">404</p>
      <h1 className="mt-2 text-h2 text-fg">Страница не найдена</h1>
      <Link to="/" className="mt-4 inline-block text-small text-brand-ink hover:underline">
        К состоянию системы
      </Link>
    </section>
  )
}
