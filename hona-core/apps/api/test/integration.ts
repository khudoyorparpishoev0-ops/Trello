import { loadConfig, type AppConfig } from '../src/core/config/env.js'

/**
 * Конфиг для интеграционных тестов: Redis и MinIO — из окружения (CI job или .env),
 * PostgreSQL — база воркера Vitest под ролью hona_app. Нет переменных → тест падает.
 */
export function integrationConfig(
  databaseUrl: string,
  overrides: Partial<AppConfig> = {},
): AppConfig {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: databaseUrl,
  })
  return { ...config, ...overrides }
}

/** Окружение для дочернего процесса API/воркера в тестах запуска и остановки. */
export function childEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'info', ...overrides }
}
