import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    fontSize: {
      '2xs': ['11px', { lineHeight: '14px', letterSpacing: '0.01em' }],
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['13px', { lineHeight: '18px' }],
      base: ['14px', { lineHeight: '20px' }],
      md: ['16px', { lineHeight: '22px' }],
      lg: ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
      xl: ['24px', { lineHeight: '30px', letterSpacing: '-0.015em' }],
      '2xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
      '3xl': ['38px', { lineHeight: '42px', letterSpacing: '-0.025em' }],
    },
    extend: {
      colors: {
        bg: c('bg'),
        surface: { DEFAULT: c('surface-1'), 1: c('surface-1'), 2: c('surface-2'), 3: c('surface-3') },
        border: c('border'),
        'border-strong': c('border-strong'),
        ring: c('ring'),
        fg: { DEFAULT: c('fg'), muted: c('fg-muted'), subtle: c('fg-subtle') },
        accent: { DEFAULT: c('accent'), fg: c('accent-fg') },
        pos: c('pos'),
        neg: c('neg'),
        warn: c('warn'),
        pos_qb: c('pos-qb'),
        pos_rb: c('pos-rb'),
        pos_wr: c('pos-wr'),
        pos_te: c('pos-te'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        e1: 'var(--shadow-1)',
        e2: 'var(--shadow-2)',
        e3: 'var(--shadow-3)',
        glow: '0 0 0 1px hsl(var(--accent) / 0.35), 0 8px 30px -8px hsl(var(--accent) / 0.45)',
      },
      spacing: { 4.5: '18px', 13: '52px', 15: '60px', 18: '72px', sidebar: '232px' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 hsl(var(--accent) / .5)' }, '100%': { boxShadow: '0 0 0 8px hsl(var(--accent) / 0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up .32s cubic-bezier(.2,.8,.2,1) both',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
      },
      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [animate],
} satisfies Config;
