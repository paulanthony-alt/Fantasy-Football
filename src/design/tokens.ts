/**
 * JS mirror of the CSS design tokens, used where CSS variables can't reach
 * (Recharts SVG presentation attributes). Keep in sync with styles/globals.css.
 * Categorical slots follow a validated CVD-safe order — assign in order, never cycle.
 */
export type ThemeName = 'dark' | 'light';

export interface ChartTheme {
  surface: string;
  grid: string;
  axis: string;
  text: string;
  textMuted: string;
  accent: string;
  pos: string;
  neg: string;
  warn: string;
  neutral: string;
  series: string[];
  position: Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'PICK', string>;
  heat: string[]; // diverging: neg → neutral → pos
}

export const chartThemes: Record<ThemeName, ChartTheme> = {
  dark: {
    surface: '#111726',
    grid: '#1f2636',
    axis: '#2c3446',
    text: '#e9edf5',
    textMuted: '#7d8597',
    accent: '#38bdf8',
    pos: '#34d399',
    neg: '#f06272',
    warn: '#f7b23b',
    neutral: '#5b6478',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    position: { QB: '#e46a92', RB: '#3cc4a0', WR: '#64a8f2', TE: '#f3a04a', K: '#9aa3b5', DST: '#9085e9', PICK: '#c3c2b7' },
    heat: ['#e66767', '#a24a52', '#3a4152', '#2f7a63', '#34d399'],
  },
  light: {
    surface: '#ffffff',
    grid: '#e3e7ee',
    axis: '#c7cdd8',
    text: '#141a28',
    textMuted: '#6b7385',
    accent: '#0c87c4',
    pos: '#1f8a5b',
    neg: '#c9303e',
    warn: '#c27a08',
    neutral: '#9aa1b0',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    position: { QB: '#c93a6b', RB: '#1b8f72', WR: '#2a78d6', TE: '#d97b0f', K: '#6b7385', DST: '#6250d6', PICK: '#52514e' },
    heat: ['#e34948', '#f1a3a3', '#eef0f4', '#94d4b6', '#1f8a5b'],
  },
};

/** Type scale (px) — mirrors tailwind fontSize. */
export const typeScale = { '2xs': 11, xs: 12, sm: 13, base: 14, md: 16, lg: 20, xl: 24, '2xl': 30, '3xl': 38 } as const;
/** Spacing scale (px) — 4px base. */
export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;
export const radii = { sm: 6, md: 8, lg: 12, xl: 16 } as const;
