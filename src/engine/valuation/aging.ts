import type { Position } from '@/data/types';
import { agingCurves, peakWindow } from './config';

/** Multiplier of peak production expected at a given age for a position. */
export function ageCurve(pos: Position, age: number): number {
  const knots = agingCurves[pos];
  if (age <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [a1, v1] = knots[i];
    if (age <= a1) {
      const [a0, v0] = knots[i - 1];
      return v0 + ((age - a0) / (a1 - a0)) * (v1 - v0);
    }
  }
  return knots[knots.length - 1][1];
}

/** Production at age+years relative to production now. */
export function ageRatio(pos: Position, age: number, years: number): number {
  const now = ageCurve(pos, age);
  return now > 0 ? ageCurve(pos, age + years) / now : 0;
}

/** Annual probability a player is out of the league / role entirely (retirement, release). */
export function attrition(pos: Position, age: number): number {
  const start = { QB: 36, RB: 29, WR: 31, TE: 32, K: 39, DST: 999 }[pos];
  return Math.min(0.6, 0.02 + Math.max(0, age - start) * 0.07);
}

export type AgePhase = 'rising' | 'peak' | 'declining' | 'cliff';
export function agePhase(pos: Position, age: number): AgePhase {
  if (pos === 'DST') return 'peak';
  const [lo, hi] = peakWindow[pos];
  if (age < lo) return 'rising';
  if (age <= hi) return 'peak';
  return ageCurve(pos, age) < 0.7 ? 'cliff' : 'declining';
}
