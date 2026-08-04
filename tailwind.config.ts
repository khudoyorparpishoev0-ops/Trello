import type { Config } from 'tailwindcss'

/**
 * IT-HONA Design System — Tailwind theme.
 * Единственный источник правды для токенов фронтенда (см. Brand Book §12.1).
 * Тематические цвета (bg/surface/fg/…) заданы через CSS-переменные в index.css
 * и переключаются между тёмной (основной) и светлой темой.
 * Бренд/семантические цвета фиксированы и не зависят от темы (Brand Book §2).
 */
const config: Config = {
  // Тема переключается через CSS-переменные (data-theme на <html>);
  // 'class' оставлен для совместимости с dark:-утилитами при необходимости.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Тематические (через CSS-переменные)
        bg: 'var(--bg)',
        sidebar: 'var(--sidebar)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        col: 'var(--surface-2)', // колонки/поля (семантический алиас spec --col)
        elevated: 'var(--elevated)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        track: 'var(--track)',
        hover: 'var(--hover)',

        // Бренд (Brand Book §2.1)
        brand: {
          DEFAULT: '#16A34A',
          fg: '#FFFFFF',
          soft: 'rgba(22,163,74,0.14)',
          border: 'rgba(22,163,74,0.35)',
        },
        graphite: '#1E1E24',
        ink: '#0B0B0F',

        // Семантические (Brand Book §2.2)
        success: { DEFAULT: '#22C55E', soft: 'rgba(34,197,94,0.14)' },
        warning: { DEFAULT: '#F59E0B', soft: 'rgba(245,158,11,0.14)' },
        error: { DEFAULT: '#EF4444', soft: 'rgba(239,68,68,0.14)' },
        info: { DEFAULT: '#3B82F6', soft: 'rgba(59,130,246,0.14)' },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      // Типографическая шкала (Brand Book §3.2)
      fontSize: {
        h1: ['32px', { lineHeight: '40px', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        small: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      // Радиусы (Brand Book §4.1)
      borderRadius: {
        card: '16px',
        btn: '14px',
        input: '12px',
        modal: '20px',
        badge: '8px',
        pill: '999px',
      },
      // Тени — минимальные (Brand Book §4.2)
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.06)',
        md: '0 4px 12px rgba(0,0,0,0.08)',
        card: '0 1px 2px rgba(0,0,0,0.20)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.28)',
      },
      // Сетка 8px (Brand Book §4)
      spacing: {
        '18': '4.5rem',
      },
      // Анимации 200–300ms, ease-in-out (Brand Book §5.2)
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        // Выдвижная панель задачи: translateX(28px) → 0 + fade
        'panel-in': {
          from: { opacity: '0', transform: 'translateX(28px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease',
        // Панели/вкладки — по спецификации: 0.22–0.24s cubic-bezier(.22,.61,.36,1)
        'slide-up': 'slide-up 220ms cubic-bezier(0.22,0.61,0.36,1)',
        'scale-in': 'scale-in 200ms cubic-bezier(0.22,0.61,0.36,1)',
        'panel-in': 'panel-in 240ms cubic-bezier(0.22,0.61,0.36,1)',
      },
      maxWidth: {
        container: '1440px',
      },
    },
  },
  plugins: [],
}

export default config
