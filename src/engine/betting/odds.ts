import { normCdf } from '@/lib/utils';

/** American odds → implied probability (includes vig). */
export function impliedProb(american: number): number {
  return american < 0 ? -american / (-american + 100) : 100 / (american + 100);
}

/** Two-way market → fair (no-vig) probabilities. */
export function noVig(a: number, b: number): [number, number] {
  const pa = impliedProb(a);
  const pb = impliedProb(b);
  const s = pa + pb;
  return [pa / s, pb / s];
}

/** Probability → American odds, optionally shading for a vig. */
export function americanFromProb(p: number, vig = 0): number {
  const q = Math.min(0.995, p * (1 + vig));
  const raw = q >= 0.5 ? -(q / (1 - q)) * 100 : ((1 - q) / q) * 100;
  return Math.round(raw / 5) * 5;
}

/** Profit per 1 unit risked at American odds. */
export function payout(american: number): number {
  return american > 0 ? american / 100 : 100 / -american;
}

/** NFL margin standard deviation (points). */
export const MARGIN_SD = 13.5;
export const TOTAL_SD = 10.5;

export function coverProb(modelMargin: number, spread: number) {
  // home covers when margin + spread > 0
  return normCdf((modelMargin + spread) / MARGIN_SD);
}
export function overProb(modelTotal: number, line: number) {
  return 1 - normCdf((line - modelTotal) / TOTAL_SD);
}
export function winProb(modelMargin: number) {
  return normCdf(modelMargin / MARGIN_SD);
}

/** Expected value per unit risked. */
export function expectedValue(p: number, american: number) {
  return p * payout(american) - (1 - p);
}

/** Fractional Kelly stake in units (1u = 1% bankroll). */
export function kellyUnits(p: number, american: number, fraction = 0.25) {
  const b = payout(american);
  const f = (b * p - (1 - p)) / b;
  return Math.max(0, f * fraction * 100);
}
