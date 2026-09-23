import {
  createTemplateDatabase,
  dropTestDatabase,
  listTestDatabases,
  TEMPLATE_DB,
} from './databases.js'

/**
 * globalSetup проекта integration (§15.3): удаляет базы прошлых прогонов,
 * один раз применяет миграции к базе-шаблону. После прогона тестовые базы удаляются.
 */
export async function setup(): Promise<void> {
  for (const name of await listTestDatabases()) await dropTestDatabase(name)
  await createTemplateDatabase()
}

export async function teardown(): Promise<void> {
  for (const name of await listTestDatabases()) {
    if (name !== TEMPLATE_DB) await dropTestDatabase(name)
  }
  await dropTestDatabase(TEMPLATE_DB)
}
