import type { Config } from 'tailwindcss'

/**
 * IT-HONA CORE — Tailwind theme по брендбуку IT-HONA (rev. 1.0).
 * Единственный источник правды для токенов фронтенда.
 *
 * Поверхности и статусы заданы CSS-переменными в src/index.css и переключаются
 * между тёмной (основной) и светлой темой через data-theme на <html>.
 * Цвета сайдбара фиксированы: тёмно-зелёная панель одинакова в обеих темах.
 *
 * Правила, зашитые в токены:
 *  — три уровня радиуса и не больше: 0 (плашки, таблицы), 2 (чипы, поля,
 *    аватары), 4 (кнопки, карточки, модалки). «Таблеток» и кругов нет,
 *    поэтому rounded-pill намеренно равен 2px;
 *  — две ступени тени, обе экранные;
 *  — анимации 150–200ms, ease-out.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Поверхности
        page: 'var(--page)',
        bg: 'var(--page)',
        surface: 'var(--surface)',
        mist: 'var(--mist)',
        'surface-2': 'var(--mist)',
        col: 'var(--mist)',
        elevated: 'var(--surface)',

        // Текст и линии
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        track: 'var(--track)',
        hover: 'var(--hover)',

        // Сайдбар — фиксированная тёмно-зелёная панель в обеих темах
        sidebar: {
          DEFAULT: '#0E3B21',
          active: '#186B36',
          line: '#186B36',
          fg: '#DCEAE1',
          muted: '#7FBF95',
          accent: '#33C561',
        },

        /**
         * Бренд. `ink` — тон для текста (насыщенный зелёный текстом не ставится),
         * `fill` — заливка кнопок и активных сегментов, `bg` — мягкая подложка.
         */
        brand: {
          DEFAULT: 'var(--green)',
          ink: 'var(--green-ink)',
          fill: 'var(--fill)',
          bg: 'var(--ok-bg)',
          soft: 'var(--ok-bg)',
          fg: '#FFFFFF',
        },

        // Статусы — пары «фон / ink». Насыщенный тон только у точек и полос.
        ok: { DEFAULT: 'var(--green)', bg: 'var(--ok-bg)', ink: 'var(--ok-ink)' },
        warn: { DEFAULT: 'var(--warn)', bg: 'var(--warn-bg)', ink: 'var(--warn-ink)' },
        err: { DEFAULT: 'var(--err)', bg: 'var(--err-bg)', ink: 'var(--err-ink)' },
        info: { DEFAULT: 'var(--info)', bg: 'var(--info-bg)', ink: 'var(--info-ink)' },

        // Прежние семантические имена — алиасы на те же токены
        success: { DEFAULT: 'var(--green)', soft: 'var(--ok-bg)' },
        warning: { DEFAULT: 'var(--warn)', soft: 'var(--warn-bg)' },
        error: { DEFAULT: 'var(--err)', soft: 'var(--err-bg)' },
      },
      fontFamily: {
        sans: ['Manrope', 'Noto Sans', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'ui-monospace', 'monospace'],
      },
      // Типографическая шкала брендбука (стр. 21–22)
      fontSize: {
        h1: ['30px', { lineHeight: '35px', fontWeight: '700', letterSpacing: '-0.02em' }],
        h2: ['24px', { lineHeight: '30px', fontWeight: '700', letterSpacing: '-0.01em' }],
        h3: ['19px', { lineHeight: '24px', fontWeight: '700' }],
        body: ['16px', { lineHeight: '25px', fontWeight: '400' }],
        small: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '19px', fontWeight: '400' }],
        label: ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.16em' }],
        // Крупные числа служебного слоя (KPI, сводки)
        num: ['26px', { lineHeight: '30px', fontWeight: '600' }],
        'num-lg': ['44px', { lineHeight: '48px', fontWeight: '600' }],
      },
      letterSpacing: {
        label: '0.16em',
        data: '0.12em',
      },
      // Три уровня радиуса, четвёртого нет
      borderRadius: {
        none: '0',
        chip: '2px',
        input: '2px',
        badge: '2px',
        pill: '2px', // «таблеток» нет — намеренно тот же уровень
        btn: '4px',
        card: '4px',
        modal: '4px',
      },
      // Две экранные ступени тени, обе тематические
      boxShadow: {
        sm: 'var(--sh-1)',
        md: 'var(--sh-2)',
        card: 'var(--sh-card)',
        'card-hover': 'var(--sh-card-hover)',
      },
      // Шаг отступов брендбука: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
      spacing: {
        18: '4.5rem',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.99)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'panel-in': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'panel-in': 'panel-in 200ms ease-out',
      },
      maxWidth: {
        container: '1600px',
        narrow: '1240px',
      },
    },
  },
  plugins: [],
}

export default config
