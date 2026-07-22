// Заготовка API IT-HONA TaskBoard.
// Назначение на этом этапе — подтвердить, что стек собран и связан:
// сервис отвечает на /api/health и проверяет доступность PostgreSQL и Redis.
// Реальные эндпоинты (аккаунты, доски, карточки, WebSocket) — следующий этап по ТЗ.

import http from 'node:http'
import pg from 'pg'
import Redis from 'ioredis'

const PORT = Number(process.env.PORT ?? 3000)

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 3000,
})

const redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
})

async function checkPostgres() {
  try {
    await pool.query('SELECT 1')
    return 'up'
  } catch {
    return 'down'
  }
}

async function checkRedis() {
  try {
    if (redis.status !== 'ready') await redis.connect()
    await redis.ping()
    return 'up'
  } catch {
    return 'down'
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

  if (url.pathname === '/api/health' || url.pathname === '/health') {
    const [postgres, redisStatus] = await Promise.all([checkPostgres(), checkRedis()])
    const ok = postgres === 'up' && redisStatus === 'up'
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        service: 'ithona-taskboard-api',
        status: ok ? 'ok' : 'degraded',
        checks: { postgres, redis: redisStatus },
        time: new Date().toISOString(),
      }),
    )
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found' }))
})

server.listen(PORT, () => {
  console.log(`[api] IT-HONA TaskBoard API (заготовка) слушает :${PORT}`)
})

// Аккуратное завершение
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close()
    pool.end().catch(() => {})
    redis.quit().catch(() => {})
    process.exit(0)
  })
}
