/**
 * Redraft model — rest-of-season value.
 * ROS = Σ_w ppg × matchup_w × availability_w × weight_w  (byes contribute 0)
 */
import type { Player } from '@/data/types';
import { clamp } from '@/lib/utils';
import { valuationConfig as cfg } from './config';
import type { ValuationContext } from './context';

export interface WeekProjection {
  week: number;
  opp: string | null;
  home: boolean;
  matchupRank: number | null;
  multiplier: number;
  availability: number;
  points: number;
  weight: number;
}

export interface RedraftResult {
  weeks: WeekProjection[];
  /** Expected points ROS (unweighted). */
  points: number;
  /** Strategy/playoff-weighted points used for value. */
  weighted: number;
  games: number;
  playoffPoints: number;
}

export function matchupMultiplier(rank: number) {
  const { toughest, softest } = cfg.matchup;
  return toughest + ((clamp(rank, 1, 32) - 1) / 31) * (softest - toughest);
}

/** Expected fraction of a week's production a player will deliver given injury status. */
export function availability(p: Player, week: number, ctx: ValuationContext): number {
  const st = p.injury.status;
  const ongoing = 1 - p.injury.risk * 0.35;
  if (st === 'O' || st === 'IR' || st === 'PUP' || st === 'SUS') {
    const back = p.injury.returnWeek ?? ctx.week + cfg.defaultWeeksOut[st];
    return week < back ? 0 : ongoing * (week === back ? 0.85 : 1);
  }
  if (week === ctx.week) return cfg.availabilityThisWeek[st] * (st === 'HEALTHY' ? ongoing : 1);
  if (st === 'D' && week === ctx.week + 1) return 0.75 * ongoing;
  return ongoing;
}

function weekMultiplier(p: Player, opp: string, home: boolean, ctx: ValuationContext): { mult: number; rank: number | null } {
  const o = ctx.teams[opp];
  const homeAdj = home ? 1.02 : 0.98;
  if (!o) return { mult: homeAdj, rank: null };
  if (p.position === 'K') return { mult: clamp(1 - o.defRating / 45, 0.85, 1.15) * homeAdj, rank: null };
  if (p.position === 'DST') return { mult: clamp(1 - o.offRating / 18, 0.7, 1.35) * homeAdj, rank: null };
  const rank = o.defVsPos[p.position];
  return { mult: matchupMultiplier(rank) * homeAdj, rank };
}

export function projectRedraft(p: Player, ppg: number, ctx: ValuationContext): RedraftResult {
  const strat = ctx.league.strategy;
  const playoffBoost = cfg.redraft.playoffBoost[strat];
  const nearBoost = cfg.redraft.nearTermBoost[strat];
  const weeks: WeekProjection[] = [];
  let points = 0;
  let weighted = 0;
  let games = 0;
  let playoffPoints = 0;
  const sched = ctx.opponents[p.team] ?? {};
  for (let w = ctx.week; w <= cfg.lastFantasyWeek; w++) {
    const g = sched[w];
    const isPlayoff = cfg.fantasyPlayoffWeeks.includes(w);
    const weight = 1 + (isPlayoff ? playoffBoost : 0) + (w < ctx.week + cfg.redraft.nearTermWeeks ? nearBoost : 0);
    if (!g) {
      weeks.push({ week: w, opp: null, home: false, matchupRank: null, multiplier: 0, availability: 0, points: 0, weight });
      continue;
    }
    const { mult, rank } = weekMultiplier(p, g.opp, g.home, ctx);
    const avail = availability(p, w, ctx);
    const pts = ppg * mult * avail;
    weeks.push({ week: w, opp: g.opp, home: g.home, matchupRank: rank, multiplier: mult, availability: avail, points: pts, weight });
    points += pts;
    weighted += pts * weight;
    games += avail;
    if (isPlayoff) playoffPoints += pts;
  }
  return { weeks, points, weighted, games, playoffPoints };
}
