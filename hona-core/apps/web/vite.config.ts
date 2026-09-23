import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Dev: Vite на 127.0.0.1:5173, `/api` проксируется в API на хосте (PORT из .env, по умолчанию 3000).
 * Пакеты workspace подключаются исходниками через условие `source`.
 * Vite читает только переменные с префиксом VITE_; секреты в бандл не попадают.
 */
const apiTarget = `http://127.0.0.1:${process.env.PORT ?? '3000'}`

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  // Sourcemap не публикуется: статика раздаётся как есть, исходники наружу не отдаются.
  build: { sourcemap: false, target: 'es2022' },
})
