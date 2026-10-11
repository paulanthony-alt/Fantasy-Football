/**
 * Trade evaluation: values each asset for the league mode and each team's strategy,
 * applies the consolidation premium, and produces verdicts, reasons, lineup impact
 * and a value-over-time timeline.
 */
import type { LeagueMode, LeagueTeam, Player, Position, Slot, Strategy, TradeAsset } from '@/data/types';
import { valuationConfig as cfg, VALUE_SCALE_MAX } from '../valuation/config';
import { valuePick, type PickTier, type PickValuation } from '../valuation/picks';
import type { PlayerValuation, Universe } from '../valuation';
import { optimizeLineup, type LineupCandidate, type LineupResult } from '../lineup/optimizer';
import { clamp, mean } from '@/lib/utils';
import { fmt } from '@/lib/format';

export type Verdict = 'win' | 'fair' | 'lose';

export interface ValuedAsset {
  key: string;
  asset: TradeAsset;
  kind: 'player' | 'pick';
  label: string;
  position: Position | 'PICK';
  playerId?: string;
  pick?: PickValuation;
  age?: number;
  redraft: number;
  dynasty: number;
  keeper: number;
  /** Week / ROS / next-two-seasons VORP for the timeline. */
  horizon: { week: number; month: number; ros: number; y1: number; y2: number };
}

export interface LineupImpact {
  before: LineupResult<LineupCandidate & { name: string }>;
  after: LineupResult<LineupCandidate & { name: string }>;
  delta: number;
}

export interface TradeSide {
  teamId: string;
  strategy: Strategy;
  receives: (ValuedAsset & { value: number; weight: number })[];
  sends: (ValuedAsset & { value: number; weight: number })[];
  receivedValue: number;
  sentValue: number;
  net: number;
  fairness: number;
  verdict: Verdict;
  reasons: { tone: 'pos' | 'neg' | 'neutral'; text: string }[];
  lineup?: LineupImpact;
}

export interface TimelinePoint {
  key: 'week' | 'month' | 'ros' | 'y1' | 'y2';
  label: string;
  values: Record<string, number>;
}

export interface TradeEvaluation {
  sides: TradeSide[];
  mine: TradeSide;
  verdict: Verdict;
  fairness: number;
  delta: number;
  timeline: TimelinePoint[];
  empty: boolean;
}

export interface TradeEngineInput {
  mode: LeagueMode;
  superflex: boolean;
  teamsInLeague: number;
  slots: Record<Slot, number>;
  season: number;
  myTeamId: string;
  myStrategy: Strategy;
  teamIds: string[];
  assets: TradeAsset[];
  rosters: LeagueTeam[];
  universe: Universe;
  players: Map<string, Player>;
  pickTierHints?: Record<string, PickTier>;
}

/** Value of an asset for a given mode and strategy (what a team would pay). */
export function tradeValue(a: Pick<ValuedAsset, 'redraft' | 'dynasty' | 'keeper' | 'kind'>, mode: LeagueMode, strategy: Strategy) {
  if (mode === 'redraft') return a.redraft;
  if (mode === 'keeper') return a.keeper;
  const w = cfg.trade.dynastyRedraftBlend[strategy];
  const pickAdj = a.kind === 'pick' ? (strategy === 'rebuild' ? 1.1 : strategy === 'win-now' ? 0.85 : 1) : 1;
  return (w * a.redraft + (1 - w) * a.dynasty) * pickAdj;
}

/** Σ value × consolidation weight by rank (desc). */
export function consolidate(values: number[]) {
  const w = cfg.trade.consolidation;
  return [...values]
    .sort((a, b) => b - a)
    .reduce((acc, v, i) => acc + v * (w[i] ?? w[w.length - 1]), 0);
}

export function verdictFor(fairness: number): Verdict {
  if (Math.abs(fairness) <= cfg.trade.fairBand) return 'fair';
  return fairness > 0 ? 'win' : 'lose';
}

function maxSeasonVorp(u: Universe) {
  let m = 1;
  u.byId.forEach((v) => (m = Math.max(m, v.dynasty.vorp[1] ?? 0)));
  return m;
}

export function valueAsset(asset: TradeAsset, input: Pick<TradeEngineInput, 'universe' | 'players' | 'teamsInLeague' | 'superflex' | 'season' | 'pickTierHints'>): ValuedAsset | null {
  const { universe: u } = input;
  if (asset.ref.kind === 'player') {
    const p = input.players.get(asset.ref.playerId);
    const v = u.byId.get(asset.ref.playerId);
    if (!p || !v) return null;
    return {
      key: asset.key, asset, kind: 'player', label: p.name, position: p.position, playerId: p.id, age: p.age,
      redraft: v.redraftValue, dynasty: v.dynastyValue, keeper: v.keeperValue,
      horizon: playerHorizon(v, u),
    };
  }
  const pick = asset.ref.pick;
  const pv = valuePick(pick, {
    teams: input.teamsInLeague,
    superflex: input.superflex,
    nextDraftSeason: input.season + 1,
    tierHint: input.pickTierHints?.[pick.originalTeamId],
  });
  // Rookie production lands from the season the pick is used.
  const rookieYear = pick.season - input.season; // 1 = next season
  const seasonVorp = (pv.dynastyValue / VALUE_SCALE_MAX) * maxSeasonVorp(u) * 0.6;
  return {
    key: asset.key, asset, kind: 'pick', label: pv.label, position: 'PICK', pick: pv,
    redraft: pv.redraftValue, dynasty: pv.dynastyValue, keeper: pv.keeperValue,
    horizon: { week: 0, month: 0, ros: 0, y1: rookieYear === 1 ? seasonVorp * 0.55 : 0, y2: rookieYear === 1 ? seasonVorp : rookieYear === 2 ? seasonVorp * 0.55 : 0 },
  };
}

function playerHorizon(v: PlayerValuation, u: Universe) {
  const pos = v.position;
  const replW = u.replacement.weekly[pos] ?? 0;
  const first4 = v.ros.weeks.slice(0, 4);
  const month = first4.reduce((a, w) => a + Math.max(0, w.points - (w.opp ? replW : 0)), 0);
  return {
    week: Math.max(0, v.week.mean - replW),
    month,
    ros: Math.max(month, v.ros.vorp),
    y1: Math.max(0, v.dynasty.vorp[1] ?? 0),
    y2: Math.max(0, v.dynasty.vorp[2] ?? 0),
  };
}

function lineupCandidates(ids: string[], u: Universe, players: Map<string, Player>) {
  const remainingWeeks = cfg.lastFantasyWeek - (u.ranked[0]?.ros.weeks[0]?.week ?? 1) + 1;
  return ids
    .map((id) => {
      const v = u.byId.get(id);
      const p = players.get(id);
      if (!v || !p) return null;
      const avg = v.ros.points / Math.max(1, remainingWeeks);
      return { id, name: p.name, position: p.position, mean: avg, sd: avg * (cfg.weeklySd[p.position] ?? 0.5) };
    })
    .filter(Boolean) as (LineupCandidate & { name: string })[];
}

export function lineupImpact(roster: string[], sent: string[], received: string[], slots: Record<Slot, number>, u: Universe, players: Map<string, Player>): LineupImpact {
  const afterIds = roster.filter((id) => !sent.includes(id)).concat(received.filter((id) => !roster.includes(id)));
  const before = optimizeLineup(lineupCandidates(roster, u, players), slots);
  const after = optimizeLineup(lineupCandidates(afterIds, u, players), slots);
  return { before, after, delta: after.total - before.total };
}

function sideReasons(side: Omit<TradeSide, 'reasons'>, mode: LeagueMode, players: Map<string, Player>, u: Universe): TradeSide['reasons'] {
  const r: TradeSide['reasons'] = [];
  const all = [...side.receives, ...side.sends].sort((a, b) => b.value - a.value);
  const best = all[0];
  if (best) {
    const gets = side.receives.some((x) => x.key === best.key);
    r.push({ tone: gets ? 'pos' : 'neg', text: `${gets ? 'Receives' : 'Gives up'} the best asset in the deal: ${best.label} (${fmt.value(best.value)}).` });
  }
  if (side.receives.length < side.sends.length && side.receives.length > 0) {
    r.push({ tone: 'pos', text: `Consolidates ${side.sends.length}-for-${side.receives.length}, opening ${side.sends.length - side.receives.length} roster spot${side.sends.length - side.receives.length > 1 ? 's' : ''} for a waiver add.` });
  } else if (side.receives.length > side.sends.length && side.sends.length > 0) {
    r.push({ tone: 'neutral', text: `Gains depth (${side.receives.length}-for-${side.sends.length}) but must clear roster space; depth pieces are discounted.` });
  }
  if (side.lineup) {
    const d = side.lineup.delta;
    if (Math.abs(d) >= 0.3) r.push({ tone: d > 0 ? 'pos' : 'neg', text: `Starting lineup projects ${fmt.signed(d)} pts/week rest of season (${fmt.num(side.lineup.before.total)} → ${fmt.num(side.lineup.after.total)}).` });
    else r.push({ tone: 'neutral', text: 'Starting lineup is essentially unchanged this season.' });
  }
  const ages = (xs: ValuedAsset[]) => xs.filter((x) => x.kind === 'player' && x.position !== 'DST').map((x) => x.age!);
  const recvAge = mean(ages(side.receives));
  const sentAge = mean(ages(side.sends));
  if (mode !== 'redraft' && ages(side.receives).length && ages(side.sends).length && Math.abs(recvAge - sentAge) >= 1.5) {
    const younger = recvAge < sentAge;
    const tone = younger ? (side.strategy === 'win-now' ? 'neutral' : 'pos') : side.strategy === 'rebuild' ? 'neg' : 'neutral';
    r.push({ tone, text: `Gets ${younger ? 'younger' : 'older'}: average age ${fmt.num(sentAge)} → ${fmt.num(recvAge)}${!younger && side.strategy === 'rebuild' ? ', which cuts against a rebuild' : younger && side.strategy === 'rebuild' ? ', aligned with a rebuild' : ''}.` });
  }
  const picksIn = side.receives.filter((x) => x.kind === 'pick');
  if (picksIn.length && mode === 'dynasty') {
    r.push({ tone: side.strategy === 'win-now' ? 'neutral' : 'pos', text: `Adds ${picksIn.map((p) => p.label).join(', ')}${side.strategy === 'win-now' ? ' — little help for a title push this season' : ' — future capital fits the team window'}.` });
  }
  if (picksIn.length && mode === 'redraft') r.push({ tone: 'neutral', text: 'Draft picks carry no value in a redraft league.' });
  for (const a of side.receives) {
    if (a.kind !== 'player') continue;
    const p = players.get(a.playerId!)!;
    if (p.injury.status !== 'HEALTHY') r.push({ tone: 'neg', text: `Takes on injury risk: ${p.name} is ${statusWord(p.injury.status)}${p.injury.detail ? ` (${p.injury.detail.split('—')[0].trim().toLowerCase()})` : ''}.` });
    const v = u.byId.get(p.id)!;
    if (mode !== 'redraft' && (v.agePhase === 'cliff' || (v.agePhase === 'declining' && p.position === 'RB'))) r.push({ tone: side.strategy === 'win-now' ? 'neutral' : 'neg', text: `${p.name} (${Math.floor(p.age)}, ${p.position}) is past the positional peak — value erodes quickly.` });
  }
  if (mode === 'redraft') {
    const po = (xs: ValuedAsset[]) => xs.filter((x) => x.playerId).reduce((acc, x) => acc + (u.byId.get(x.playerId!)?.ros.playoffPoints ?? 0), 0);
    const d = po(side.receives) - po(side.sends);
    if (Math.abs(d) > 4) r.push({ tone: d > 0 ? 'pos' : 'neg', text: `Fantasy playoffs (Wk 15–17): ${fmt.signed(d)} projected points from the assets swapped.` });
  }
  return r.slice(0, 6);
}

const statusWord = (s: string) => ({ Q: 'questionable', D: 'doubtful', O: 'out', IR: 'on IR', PUP: 'on PUP', SUS: 'suspended' })[s] ?? s;

export function evaluateTrade(input: TradeEngineInput): TradeEvaluation {
  const valued = input.assets.map((a) => valueAsset(a, input)).filter(Boolean) as ValuedAsset[];
  const teamIds = input.teamIds;
  const sides: TradeSide[] = teamIds.map((teamId) => {
    const strategy = teamId === input.myTeamId ? input.myStrategy : 'balanced';
    const withValue = (a: ValuedAsset) => ({ ...a, value: tradeValue(a, input.mode, strategy), weight: 1 });
    const receives = valued.filter((a) => a.asset.to === teamId).map(withValue).sort((a, b) => b.value - a.value);
    const sends = valued.filter((a) => a.asset.from === teamId).map(withValue).sort((a, b) => b.value - a.value);
    receives.forEach((a, i) => (a.weight = cfg.trade.consolidation[i] ?? cfg.trade.consolidation.at(-1)!));
    sends.forEach((a, i) => (a.weight = cfg.trade.consolidation[i] ?? cfg.trade.consolidation.at(-1)!));
    const receivedValue = consolidate(receives.map((a) => a.value));
    const sentValue = consolidate(sends.map((a) => a.value));
    const net = receivedValue - sentValue;
    const fairness = receivedValue + sentValue === 0 ? 0 : net / Math.max(receivedValue, sentValue, 1);
    const roster = input.rosters.find((t) => t.id === teamId);
    const recvIds = receives.filter((a) => a.playerId).map((a) => a.playerId!);
    const sentIds = sends.filter((a) => a.playerId).map((a) => a.playerId!);
    const lineup = roster && (recvIds.length || sentIds.length) ? lineupImpact(roster.playerIds, sentIds, recvIds, input.slots, input.universe, input.players) : undefined;
    const side = { teamId, strategy, receives, sends, receivedValue, sentValue, net, fairness, verdict: verdictFor(fairness), lineup };
    return { ...side, reasons: sideReasons(side, input.mode, input.players, input.universe) };
  });
  const mine = sides.find((s) => s.teamId === input.myTeamId) ?? sides[0];

  const horizonKeys: TimelinePoint['key'][] = ['week', 'month', 'ros', 'y1', 'y2'];
  const labels: Record<TimelinePoint['key'], string> = { week: '1 wk', month: '4 wks', ros: 'Season', y1: '2 seasons', y2: '3 seasons' };
  const cumAt = (a: ValuedAsset, k: TimelinePoint['key']) => {
    const h = a.horizon;
    if (k === 'week') return h.week;
    if (k === 'month') return h.month;
    if (k === 'ros') return h.ros;
    if (k === 'y1') return h.ros + h.y1;
    return h.ros + h.y1 + h.y2;
  };
  const timeline: TimelinePoint[] = horizonKeys.map((k) => {
    const values: Record<string, number> = {};
    for (const s of sides) {
      const total = (xs: ValuedAsset[]) => xs.reduce((acc, a) => acc + cumAt(a, k), 0);
      values[s.teamId] = total(s.receives) - total(s.sends);
    }
    return { key: k, label: labels[k], values };
  });

  const empty = valued.length === 0 || sides.every((s) => s.receives.length === 0 && s.sends.length === 0);
  return { sides, mine, verdict: empty ? 'fair' : mine.verdict, fairness: empty ? 0 : mine.fairness, delta: mine.net, timeline, empty };
}

/** Map fairness (−∞…∞) onto a −1…1 gauge position. */
export function gaugePosition(fairness: number) {
  return clamp(fairness / 0.4, -1, 1);
}
