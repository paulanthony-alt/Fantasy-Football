/**
 * Valuation engine entry point: prices every player in the universe for one league.
 * Output values share a 0–10,000 market scale across redraft, keeper and dynasty.
 */
import type { LeagueMode, Player, Position } from '@/data/types';
import { VALUE_SCALE_MAX, valuationConfig as cfg } from './config';
import { fantasyPoints } from './scoring';
import { projectRedraft, type RedraftResult } from './redraft';
import { draftCapitalPremium, dynastyRaw, projectDynasty, type DynastyProjection } from './dynasty';
import { replacementIndex, type ValuationContext } from './context';
import { agePhase, type AgePhase } from './aging';

export * from './context';
export * from './config';
export * from './scoring';
export * from './picks';
export * from './aging';
export { matchupMultiplier, availability } from './redraft';

export interface WeekProj {
  mean: number;
  sd: number;
  floor: number;
  ceiling: number;
  opp: string | null;
  home: boolean;
  matchupRank: number | null;
  bye: boolean;
}

export interface PlayerValuation {
  playerId: string;
  position: Position;
  /** Healthy points per game under league scoring. */
  ppg: number;
  week: WeekProj;
  ros: RedraftResult & { vorp: number; ppg: number };
  dynasty: DynastyProjection & { vorp: number[]; raw: number };
  redraftValue: number;
  dynastyValue: number;
  keeperValue: number;
  /** Value under the league's mode (what rankings show). */
  value: number;
  overallRank: number;
  posRank: number;
  tier: number;
  agePhase: AgePhase;
}

export interface Universe {
  byId: Map<string, PlayerValuation>;
  ranked: PlayerValuation[];
  replacement: {
    rosWeighted: Record<Position, number>;
    season: Record<Position, number>;
    weekly: Record<Position, number>;
  };
  refs: { redraft: number; dynasty: number; keeper: number };
}

/** Map a raw VORP to the market scale. Convex above replacement, soft floor below. */
export function scaleValue(v: number, ref: number) {
  const { exponent, floor, softness } = cfg.scale;
  if (ref <= 0) return floor;
  if (v <= 0) return floor * Math.exp(v / (softness * ref));
  return floor + (VALUE_SCALE_MAX - floor) * Math.min(1.15, v / ref) ** exponent;
}

export function tierFor(value: number) {
  const idx = cfg.tiers.findIndex((t) => value >= t);
  return idx === -1 ? cfg.tiers.length + 1 : idx + 1;
}

export function modeValue(v: Pick<PlayerValuation, 'redraftValue' | 'dynastyValue' | 'keeperValue'>, mode: LeagueMode) {
  return mode === 'redraft' ? v.redraftValue : mode === 'keeper' ? v.keeperValue : v.dynastyValue;
}

function replacementOf(values: Map<Position, number[]>, idx: Record<Position, number>) {
  const out = {} as Record<Position, number>;
  for (const [pos, arr] of values) {
    const sorted = [...arr].sort((a, b) => b - a);
    out[pos] = sorted[Math.min(idx[pos], sorted.length - 1)] ?? 0;
  }
  return out;
}

export function weeklyProjection(ppg: number, ros: RedraftResult, pos: Position, week: number): WeekProj {
  const wk = ros.weeks.find((w) => w.week === week);
  if (!wk || !wk.opp) return { mean: 0, sd: 0, floor: 0, ceiling: 0, opp: null, home: false, matchupRank: null, bye: true };
  const mean = wk.points;
  const sd = Math.max(1.5, ppg * wk.multiplier * (cfg.weeklySd[pos] ?? 0.5)) * (wk.availability > 0 ? 1 : 0);
  return {
    mean,
    sd,
    floor: Math.max(0, mean - 1.28 * sd),
    ceiling: mean + 1.28 * sd,
    opp: wk.opp,
    home: wk.home,
    matchupRank: wk.matchupRank,
    bye: false,
  };
}

export function valueUniverse(players: Player[], ctx: ValuationContext): Universe {
  const { league } = ctx;
  const idx = replacementIndex(league);
  const discount = cfg.dynasty.discount[league.strategy];

  // Pass 1 — per-player projections
  const rows = players.map((p) => {
    const ppg = fantasyPoints(p.projection, p.position, league.scoring);
    const ros = projectRedraft(p, ppg, ctx);
    const remaining = cfg.lastFantasyWeek - ctx.week + 1;
    const dyn = projectDynasty(p, ppg, (ros.games / Math.max(1, remaining)) * (remaining / cfg.gamesPerSeason), ctx);
    return { p, ppg, ros, dyn };
  });

  // Pass 2 — replacement levels per position
  const groups = <T,>(f: (r: (typeof rows)[number]) => T) => {
    const m = new Map<Position, T[]>();
    rows.forEach((r) => {
      const arr = m.get(r.p.position) ?? [];
      arr.push(f(r));
      m.set(r.p.position, arr);
    });
    return m;
  };
  const replRos = replacementOf(groups((r) => r.ros.weighted), idx);
  const replSeason = replacementOf(groups((r) => r.ppg * cfg.gamesPerSeason * (r.p.depth === 1 ? 1 : 0.9)), idx);
  const weekMeans = groups((r) => weeklyProjection(r.ppg, r.ros, r.p.position, ctx.week).mean);
  const replWeek = replacementOf(weekMeans, idx);

  // Pass 3 — VORP
  const calc = rows.map((r) => {
    const rosVorp = r.ros.weighted - replRos[r.p.position];
    const seasonVorp = r.dyn.seasonPoints.map((pts, y) => pts - replSeason[r.p.position] * (y === 0 ? Math.min(1, r.ros.weeks.length / cfg.gamesPerSeason) : 1));
    const dRaw = dynastyRaw(seasonVorp, discount);
    const keeperRaw = rosVorp + cfg.keeper.nextSeasonWeight * Math.max(seasonVorp[1] ?? 0, (seasonVorp[1] ?? 0) * 0.2);
    return { ...r, rosVorp, seasonVorp, dRaw, keeperRaw };
  });
  const ref = (f: (c: (typeof calc)[number]) => number) => Math.max(1, ...calc.map(f));
  const refs = { redraft: ref((c) => c.rosVorp), dynasty: ref((c) => c.dRaw), keeper: ref((c) => c.keeperRaw) };

  // Pass 4 — scale, rank, tier
  const vals: PlayerValuation[] = calc.map((c) => {
    const p = c.p;
    const haircut = 1 - cfg.riskHaircut * p.injury.risk;
    const redraftValue = scaleValue(c.rosVorp, refs.redraft) * haircut;
    const dynastyValue = scaleValue(c.dRaw, refs.dynasty) * (1 + draftCapitalPremium(p)) * (1 - cfg.riskHaircut * 0.3 * p.injury.risk);
    const keeperValue = scaleValue(c.keeperRaw, refs.keeper) * haircut;
    const v: PlayerValuation = {
      playerId: p.id,
      position: p.position,
      ppg: c.ppg,
      week: weeklyProjection(c.ppg, c.ros, p.position, ctx.week),
      ros: { ...c.ros, vorp: c.rosVorp, ppg: c.ros.games > 0 ? c.ros.points / c.ros.games : 0 },
      dynasty: { ...c.dyn, vorp: c.seasonVorp, raw: c.dRaw },
      redraftValue: Math.min(VALUE_SCALE_MAX, redraftValue),
      dynastyValue: Math.min(VALUE_SCALE_MAX, dynastyValue),
      keeperValue: Math.min(VALUE_SCALE_MAX, keeperValue),
      value: 0,
      overallRank: 0,
      posRank: 0,
      tier: 0,
      agePhase: agePhase(p.position, p.age),
    };
    v.value = modeValue(v, league.mode);
    v.tier = tierFor(v.value);
    return v;
  });

  const ranked = [...vals].sort((a, b) => b.value - a.value);
  const posCount: Partial<Record<Position, number>> = {};
  ranked.forEach((v, i) => {
    v.overallRank = i + 1;
    posCount[v.position] = (posCount[v.position] ?? 0) + 1;
    v.posRank = posCount[v.position]!;
  });

  return {
    byId: new Map(vals.map((v) => [v.playerId, v])),
    ranked,
    replacement: { rosWeighted: replRos, season: replSeason, weekly: replWeek },
    refs,
  };
}
