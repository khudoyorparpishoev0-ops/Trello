import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/**
 * Корневой конфиг Vitest: покрытие для обоих проектов (vitest.workspace.ts).
 * Локально переменные интеграционных тестов берутся из hona-core/.env (разбор
 * средствами Node, без source в shell); в CI они заданы окружением job.
 */
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  // Не искать postcss.config.js вверх по дереву: в корне репозитория лежит конфиг легаси (R-14).
  css: { postcss: {} },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'json-summary'],
      include: [
        'packages/shared/src/**/*.ts',
        'apps/api/src/core/**/*.ts',
        'apps/api/src/modules/**/*.ts',
        'apps/api/src/plugins/**/*.ts',
        'apps/worker/src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.int.test.ts',
        // реэкспорт и типы без исполняемого кода
        'packages/shared/src/index.ts',
        'apps/worker/src/outbox/types.ts',
        // точка входа процесса: проверяется запуском в main.int.test.ts
        'apps/worker/src/main.ts',
      ],
      // §23.8: apps/api/src/core и apps/worker/src/outbox — не меньше 90 % строк.
      thresholds: {
        'apps/api/src/core/**/*.ts': { lines: 90 },
        'apps/worker/src/outbox/**/*.ts': { lines: 90 },
        'packages/shared/src/**/*.ts': { lines: 90 },
      },
    },
  },
})
