import type { Game, League, Position, SkillPosition, Slot, Team } from '@/data/types';
import { valuationConfig as cfg } from './config';

export type ValuationLeague = Pick<League, 'mode' | 'superflex' | 'scoring' | 'teams' | 'slots' | 'strategy'>;

export interface Opponent {
  opp: string;
  home: boolean;
}

export interface ValuationContext {
  league: ValuationLeague;
  season: number;
  /** Upcoming week (first week counted as "rest of season"). */
  week: number;
  teams: Record<string, Team>;
  /** team → week → opponent (missing = bye). */
  opponents: Record<string, Record<number, Opponent>>;
}

export function buildOpponents(games: Game[]): ValuationContext['opponents'] {
  const out: ValuationContext['opponents'] = {};
  for (const g of games) {
    (out[g.home] ??= {})[g.week] = { opp: g.away, home: true };
    (out[g.away] ??= {})[g.week] = { opp: g.home, home: false };
  }
  return out;
}

export function buildContext(league: ValuationLeague, data: { season: number; week: number; teams: Team[]; games: Game[] }): ValuationContext {
  return {
    league,
    season: data.season,
    week: data.week,
    teams: Object.fromEntries(data.teams.map((t) => [t.id, t])),
    opponents: buildOpponents(data.games),
  };
}

/** Slots after applying the Superflex toggle. */
export function effectiveSlots(league: ValuationLeague): Record<Slot, number> {
  const s = { ...league.slots };
  if (league.superflex && s.SUPERFLEX === 0 && s.QB < 2) s.SUPERFLEX = 1;
  if (!league.superflex) s.SUPERFLEX = 0;
  return s;
}

/** League-wide starters demanded per position (starters + flex shares). */
export function positionDemand(league: ValuationLeague): Record<Position, number> {
  const s = effectiveSlots(league);
  const T = league.teams;
  const skill = (p: SkillPosition) => T * ((s[p] ?? 0) + s.FLEX * cfg.flexShare[p] + s.SUPERFLEX * cfg.superflexShare[p]);
  return { QB: skill('QB'), RB: skill('RB'), WR: skill('WR'), TE: skill('TE'), K: T * s.K, DST: T * s.DST };
}

/** 0-based index of the replacement-level player at each position. */
export function replacementIndex(league: ValuationLeague): Record<Position, number> {
  const d = positionDemand(league);
  const out = {} as Record<Position, number>;
  (Object.keys(d) as Position[]).forEach((p) => {
    const bench = league.teams * (cfg.benchDemand[p] ?? 0) * 0.25;
    out[p] = Math.max(0, Math.round(d[p] + bench));
  });
  return out;
}
