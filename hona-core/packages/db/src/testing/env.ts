/**
 * Окружение интеграционных тестов. Отсутствие переменных — громкая ошибка,
 * а не тихий пропуск тестов.
 *
 *   TEST_DATABASE_ADMIN_URL — суперпользователь кластера (создание/удаление баз hona_test_*);
 *   DATABASE_URL            — роль hona_app (приложение);
 *   DATABASE_URL_MIGRATE    — роль hona_migrate (миграции, очистка между тестами);
 *   HONA_READONLY_PASSWORD  — пароль роли hona_readonly (тест прав ролей).
 *
 * Имя базы в URL заменяется на hona_test_*: dev-база `hona` тестами не трогается.
 */
export interface TestDbEnv {
  readonly adminUrl: string
  readonly appUrl: string
  readonly migrateUrl: string
  readonly readonlyPassword: string
}

const REQUIRED = [
  'TEST_DATABASE_ADMIN_URL',
  'DATABASE_URL',
  'DATABASE_URL_MIGRATE',
  'HONA_READONLY_PASSWORD',
] as const

export function readTestDbEnv(source: NodeJS.ProcessEnv = process.env): TestDbEnv {
  const missing = REQUIRED.filter((name) => !source[name])
  if (missing.length > 0) {
    throw new Error(
      `Integration tests need a PostgreSQL 16 cluster with hona roles. Missing env: ${missing.join(', ')}. ` +
        'See hona-core/docs/development.md.',
    )
  }
  return {
    adminUrl: source.TEST_DATABASE_ADMIN_URL as string,
    appUrl: source.DATABASE_URL as string,
    migrateUrl: source.DATABASE_URL_MIGRATE as string,
    readonlyPassword: source.HONA_READONLY_PASSWORD as string,
  }
}

/** Номер воркера Vitest: у каждого своя база, файлы идут параллельно без влияния. */
export function vitestPoolId(source: NodeJS.ProcessEnv = process.env): string {
  const id = source.VITEST_POOL_ID ?? '0'
  if (!/^[0-9]{1,4}$/.test(id)) throw new Error('Unexpected VITEST_POOL_ID format')
  return id
}
