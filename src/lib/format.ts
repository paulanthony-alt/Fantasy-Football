export const fmt = {
  int: (v: number) => Math.round(v).toLocaleString('en-US'),
  num: (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—'),
  signed: (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d),
  signedInt: (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)).toLocaleString('en-US'),
  pct: (v: number, d = 0) => `${(v * 100).toFixed(d)}%`,
  signedPct: (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v * 100).toFixed(d)}%`,
  odds: (v: number) => (v > 0 ? `+${v}` : `${v}`),
  spread: (v: number) => (v === 0 ? 'PK' : v > 0 ? `+${v}` : `${v}`),
  units: (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}u`,
  value: (v: number) => Math.round(v).toLocaleString('en-US'),
};

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-z' .-]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
