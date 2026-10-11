/**
 * Dynasty model — multi-year value.
 * ppg_y = basePpg_y × ageRatio(pos, age, y) × control_y × survival_y
 * raw   = Σ_y discount^y × VORP_y      (y = 0…years-1)
 */
import type { Player } from '@/data/types';
import { clamp } from '@/lib/utils';
import { valuationConfig as cfg } from './config';
import { ageRatio, attrition } from './aging';
import type { ValuationContext } from './context';

export interface DynastyProjection {
  /** Projected season fantasy points for each future season (y=0 = current). */
  seasonPoints: number[];
  ppgByYear: number[];
  survival: number[];
}

/** Starter-level ppg a backup would post if promoted (for role-growth). */
export function starterPpgEstimate(p: Player, ppg: number) {
  if (p.depth === 1) return ppg;
  if (p.position === 'QB') return 12 + 9 * p.talent;
  return ppg * cfg.dynasty.backupStarterMultiplier;
}

export function projectDynasty(p: Player, ppg: number, rosFraction: number, ctx: ValuationContext): DynastyProjection {
  const d = cfg.dynasty;
  const seasonPoints: number[] = [];
  const ppgByYear: number[] = [];
  const survival: number[] = [];
  let alive = 1;
  const starterPpg = starterPpgEstimate(p, ppg);
  const young = p.age < d.youthAge;
  for (let y = 0; y < d.years; y++) {
    if (y > 0) alive *= 1 - attrition(p.position, p.age + y - 1);
    const growth = p.depth > 1 ? clamp(y * d.roleGrowthPerYear * (young ? 1 : 0.35), 0, 1) : 0;
    const base = ppg + (starterPpg - ppg) * growth;
    const control = p.position === 'DST' || p.position === 'K' || y < p.contractYearsLeft ? 1 : d.postContractFactor;
    const ppgY = base * (p.position === 'DST' ? 1 : ageRatio(p.position, p.age, y)) * control * (p.position === 'DST' ? 0.9 ** y : 1);
    ppgByYear.push(ppgY);
    survival.push(alive);
    // Current season: only the remaining fraction counts toward a dynasty roster's value this year.
    const games = y === 0 ? cfg.gamesPerSeason * clamp(rosFraction, 0, 1) : cfg.gamesPerSeason * (1 - p.injury.risk * 0.15);
    seasonPoints.push(ppgY * games * alive);
  }
  void ctx;
  return { seasonPoints, ppgByYear, survival };
}

/** Discounted sum of VORP across seasons. Below-replacement years count at 20% (cuttable). */
export function dynastyRaw(seasonVorp: number[], discount: number) {
  return seasonVorp.reduce((acc, v, y) => acc + discount ** y * (y === 0 ? cfg.dynasty.currentSeasonWeight : 1) * (v > 0 ? v : v * 0.1), 0);
}

export function draftCapitalPremium(p: Player) {
  if (!p.draft || p.experience > 2) return 0;
  return cfg.dynasty.draftCapitalPremium[p.draft.round] ?? 0;
}
