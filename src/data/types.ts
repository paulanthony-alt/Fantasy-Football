/* ────────────────────────────── Domain model ────────────────────────────── */

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type SkillPosition = 'QB' | 'RB' | 'WR' | 'TE';
export const SKILL_POSITIONS: SkillPosition[] = ['QB', 'RB', 'WR', 'TE'];
export const ALL_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

export type InjuryStatus = 'HEALTHY' | 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS';

export interface Team {
  id: string; // abbreviation, e.g. "KC"
  city: string;
  name: string;
  conference: 'AFC' | 'NFC';
  division: 'East' | 'North' | 'South' | 'West';
  colors: { primary: string; secondary: string };
  bye: number;
  /** Points per game above league average (offense). */
  offRating: number;
  /** Points per game prevented vs league average (defense, + = good). */
  defRating: number;
  /** Offensive plays per game. */
  pace: number;
  passRate: number;
  /** 1 = best. */
  oLinePassBlockRank: number;
  oLineRunBlockRank: number;
  passRushRank: number;
  /** Fantasy points allowed rank vs position. 1 = toughest matchup, 32 = softest. */
  defVsPos: Record<SkillPosition, number>;
  dome: boolean;
}

/** Per-game raw stat line (projection or actual). */
export interface StatLine {
  passAtt: number;
  passCmp: number;
  passYds: number;
  passTd: number;
  int: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  targets: number;
  rec: number;
  recYds: number;
  recTd: number;
  fumLost: number;
  /** Kicker / defense fantasy points (pre-computed, scoring-agnostic). */
  kPts?: number;
  dstPts?: number;
}

export interface PlayerUsage {
  snapPct: number;
  routePct: number;
  targetShare: number;
  carryShare: number;
  airYardsShare: number;
  redZoneShare: number;
  aDot: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  age: number;
  experience: number;
  draft: { year: number; round: number; pick: number } | null;
  contractYearsLeft: number;
  injury: { status: InjuryStatus; detail?: string; returnWeek?: number; risk: number };
  depth: number;
  /** Healthy per-game projection for the rest of season. */
  projection: StatLine;
  usage: PlayerUsage;
  /** 0–1 underlying talent/role score used by the dynasty model. */
  talent: number;
  sleeperId?: string;
  headshotUrl?: string;
}

export type WeatherCondition = 'Dome' | 'Clear' | 'Cloudy' | 'Rain' | 'Snow' | 'Wind';
export interface Weather {
  condition: WeatherCondition;
  tempF: number;
  windMph: number;
}

export interface Game {
  id: string;
  season: number;
  week: number;
  home: string;
  away: string;
  kickoff: string; // ISO
  status: 'scheduled' | 'live' | 'final';
  homeScore?: number;
  awayScore?: number;
  weather: Weather;
  network: string;
}

export interface GameLog {
  week: number;
  gameId: string;
  opponent: string;
  home: boolean;
  teamScore: number;
  oppScore: number;
  weather: Weather;
  oppRankVsPos: number;
  stats: StatLine;
  snapPct: number;
  routes: number;
  airYards: number;
  redZoneTouches: number;
  /** Per-game projection multiplier used to build "projected" for that week. */
  projectedFactor: number;
}

export interface LinePoint {
  t: number;
  spread: number;
  total: number;
  homeMl: number;
}

export interface GameOdds {
  gameId: string;
  spread: number; // home spread (negative = home favored)
  total: number;
  homeMl: number;
  awayMl: number;
  open: { spread: number; total: number; homeMl: number };
  history: LinePoint[];
  book: string;
  publicHomePct: number;
}

export type PropMarket = 'passYds' | 'passTd' | 'rushYds' | 'recYds' | 'rec' | 'anytimeTd';
export interface PlayerProp {
  id: string;
  playerId: string;
  gameId: string;
  market: PropMarket;
  line: number;
  overOdds: number;
  underOdds: number;
  openLine: number;
}

export type NewsType = 'injury' | 'transaction' | 'depth' | 'performance' | 'practice';
export interface NewsItem {
  id: string;
  ts: number;
  playerId?: string;
  team?: string;
  headline: string;
  body: string;
  type: NewsType;
  impact: 'positive' | 'negative' | 'neutral';
  source: string;
  url?: string;
}

export interface TrendingPlayer {
  playerId: string;
  adds: number;
  drops: number;
  rosterPct: number;
  rosterPctDelta: number;
}

/** A response annotated with provenance so the UI can show "last updated". */
export interface Sourced<T> {
  data: T;
  source: string;
  fetchedAt: number;
  stale: boolean;
}

/* ────────────────────────────── League model ────────────────────────────── */

export type LeagueMode = 'redraft' | 'dynasty' | 'keeper';
export type Strategy = 'win-now' | 'balanced' | 'rebuild';
export type Slot = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'SUPERFLEX' | 'K' | 'DST';
export const SLOT_ORDER: Slot[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'K', 'DST'];

export interface ScoringSettings {
  /** Points per reception: 1 (PPR), 0.5 (half), 0 (standard). */
  ppr: 0 | 0.5 | 1;
  /** Extra points per TE reception (TE premium). */
  tePremium: number;
  passTd: 4 | 5 | 6;
  /** Points per passing yard (e.g. 0.04 = 1 per 25). */
  passYd: number;
  int: number;
}

export interface DraftPick {
  id: string;
  season: number;
  round: number;
  /** Team that originally owned the pick (drives projected slot). */
  originalTeamId: string;
  /** 1-based slot if known; otherwise projected from tier. */
  slot?: number;
  projected?: 'early' | 'mid' | 'late';
}

export interface LeagueTeam {
  id: string;
  name: string;
  owner: string;
  playerIds: string[];
  picks: DraftPick[];
  record?: { w: number; l: number; t?: number };
}

export interface League {
  id: string;
  name: string;
  platform: 'demo' | 'manual' | 'sleeper';
  externalId?: string;
  season: number;
  mode: LeagueMode;
  superflex: boolean;
  scoring: ScoringSettings;
  teams: number;
  rosterSize: number;
  slots: Record<Slot, number>;
  keepers?: number;
  strategy: Strategy;
  myTeamId: string;
  rosters: LeagueTeam[];
  createdAt: number;
  updatedAt: number;
}

/* ────────────────────────────── Trades & bets ────────────────────────────── */

export type AssetRef = { kind: 'player'; playerId: string } | { kind: 'pick'; pick: DraftPick };
export interface TradeAsset {
  key: string;
  ref: AssetRef;
  from: string;
  to: string;
}
export interface SavedTrade {
  id: string;
  leagueId: string;
  teamIds: string[];
  assets: TradeAsset[];
  createdAt: number;
  verdict: 'win' | 'fair' | 'lose';
  delta: number;
  mode: LeagueMode;
  note?: string;
}

export type BetType = 'spread' | 'total' | 'moneyline' | 'prop' | 'parlay';
export type BetResult = 'pending' | 'win' | 'loss' | 'push';
export interface Bet {
  id: string;
  placedAt: number;
  type: BetType;
  description: string;
  odds: number;
  units: number;
  result: BetResult;
  book: string;
  edge?: number;
  gameId?: string;
}
