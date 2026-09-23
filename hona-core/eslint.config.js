// @ts-check
import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ESLint HONA Core 2.0 (§4, §14.3, §23.3, §23.9).
 *   • границы пакетов: web ↛ db/api/worker, api ↛ worker/web, worker ↛ api/web,
 *     db ↛ apps, shared ↛ ничего из репозитория;
 *   • hona-core/** ↛ легаси (src/, api/, shared/ корня репозитория и их алиасы);
 *   • process.env — только в модулях конфигурации и тестовой инфраструктуре;
 *   • SQL только параметризованный: sql.raw и query(`…${x}`) запрещены.
 */

const SOURCE_FILES = ['**/*.{ts,tsx}']

/**
 * Алиасы легаси v1. Относительные пути за пределы hona-core/ (и за пределы своего
 * пакета) проверяет тест-страж tests/guards/architecture.test.ts: ему нужен
 * реальный путь файла, а не шаблон строки импорта.
 */
const LEGACY_IMPORTS = [
  { group: ['@/*', '#shared/*'], message: 'Legacy v1 aliases are not available in HONA Core 2.0.' },
]

/** Запрещённые пакеты по зонам (§4, «Правила зависимостей»). */
function boundary(files, forbidden, message) {
  return {
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...LEGACY_IMPORTS,
            ...forbidden.map((name) => ({ group: [name, `${name}/*`], message })),
          ],
        },
      ],
    },
  }
}

const PROCESS_ENV_ALLOWED = [
  'apps/api/src/core/config/env.ts',
  'apps/worker/src/config/env.ts',
  'packages/db/src/config/env.ts',
  'packages/db/src/testing/**',
  'apps/*/test/**',
  '**/*.test.{ts,tsx}',
  'vitest.config.ts',
  'apps/web/vite.config.ts',
  'scripts/**',
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.tsbuild/**',
      'packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  {
    files: SOURCE_FILES,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'import-x': importX },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      'import-x/no-duplicates': 'error',
      'no-restricted-imports': ['error', { patterns: LEGACY_IMPORTS }],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read configuration only in the config/env.ts module of each app (§23.9).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message: 'sql.raw bypasses parameterisation (§14.3). Use the sql`` tag.',
        },
        {
          selector:
            "CallExpression[callee.property.name='query'] > TemplateLiteral.arguments:first-child[expressions.length>0]",
          message: 'Do not interpolate into SQL text; pass values as parameters (§14.3).',
        },
        {
          selector:
            "CallExpression[callee.property.name='query'] > BinaryExpression.arguments:first-child[operator='+']",
          message: 'Do not concatenate SQL text; pass values as parameters (§14.3).',
        },
      ],
    },
  },
  boundary(
    ['apps/web/**'],
    ['@hona/db', '@hona/api', '@hona/worker', 'pg', 'drizzle-orm', 'ioredis', 'fastify'],
    'apps/web may import only @hona/shared from the workspace (§4).',
  ),
  boundary(
    ['apps/api/**'],
    ['@hona/web', '@hona/worker'],
    'apps/api may import only packages/* from the workspace (§4).',
  ),
  boundary(
    ['apps/worker/**'],
    ['@hona/web', '@hona/api'],
    'apps/worker may import only packages/* from the workspace (§4).',
  ),
  boundary(
    ['packages/db/**'],
    ['@hona/web', '@hona/api', '@hona/worker'],
    'packages/db may import only packages/shared (§4).',
  ),
  boundary(
    ['packages/shared/**'],
    ['@hona/web', '@hona/api', '@hona/worker', '@hona/db', 'pg', 'drizzle-orm', 'react'],
    'packages/shared must not depend on other workspace packages, pg or React (§4).',
  ),
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    ignores: ['**/*.test.{ts,tsx}', 'packages/db/src/testing/**'],
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: false, optionalDependencies: false, peerDependencies: false },
      ],
    },
  },
  {
    files: PROCESS_ENV_ALLOWED,
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'apps/*/test/**', 'tests/**/*.ts', 'packages/db/tests/**/*.ts'],
    rules: {
      // Тесты вызывают тестовую инфраструктуру и заглушки, для которых строгая
      // типизация unsafe-* даёт шум без пользы. Остальные правила действуют.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Заглушки обработчиков в тестах — async по контракту, без await внутри.
      '@typescript-eslint/require-await': 'off',
    },
  },
)
