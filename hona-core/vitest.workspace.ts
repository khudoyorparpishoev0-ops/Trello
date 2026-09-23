import { defineWorkspace } from 'vitest/config'

/**
 * Проекты Vitest (§23.8):
 *   unit        — без внешних зависимостей: чистые функции, API через app.inject(),
 *                 web в jsdom (окружение задаётся в самих файлах *.test.tsx);
 *   integration — настоящий PostgreSQL (и Redis/MinIO для readiness): база-шаблон
 *                 с миграциями и отдельная база на каждый воркер Vitest (§15.3).
 * Пакеты workspace подключаются исходниками через условие `source`.
 */
const shared = {
  resolve: { conditions: ['source'] },
  esbuild: { jsx: 'automatic' as const },
}

export default defineWorkspace([
  {
    ...shared,
    test: {
      name: 'unit',
      include: [
        'packages/shared/src/**/*.test.ts',
        'apps/*/src/**/*.test.{ts,tsx}',
        'tests/guards/**/*.test.ts',
      ],
      exclude: ['**/*.int.test.ts', '**/node_modules/**', '**/dist/**'],
      environment: 'node',
    },
  },
  {
    ...shared,
    test: {
      name: 'integration',
      include: [
        'packages/db/tests/**/*.test.ts',
        'apps/*/src/**/*.int.test.ts',
        'tests/integration/**/*.int.test.ts',
      ],
      exclude: ['**/node_modules/**', '**/dist/**'],
      environment: 'node',
      globalSetup: ['./packages/db/src/testing/global-setup.ts'],
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  },
])
