import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit нужен только для генерации SQL-миграций из схемы (§23.7).
 * Подключение к БД ему не требуется: миграции применяет `src/migrate.ts`
 * под ролью `hona_migrate`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
})
