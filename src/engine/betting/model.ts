/**
 * Betting model: game margins/totals from team power ratings plus injury adjustments,
 * prop projections from the player projection and matchup, and edge vs the market.
 */
import type { GameOdds, Game, Player, PlayerProp, Team } from '@/data/types';
import { clamp, normCdf } from '@/lib/utils';
import { coverProb, expectedValue, impliedProb, kellyUnits, noVig, overProb, winProb } from './odds';
import { matchupMultiplier } from '../valuation/redraft';

export const VALUE_EDGE = 0.03;
/** Weight on the raw model vs the market (markets are efficient — shrink toward them). */
export const MODEL_WEIGHT = { game: 0.4, prop: 0.5 };

export interface GameModel {
  homePts: number;
  awayPts: number;
  margin: number; // home − away
  total: number;
}

export interface MarketEdge {
  label: string;
  side: string;
  modelProb: number;
  marketProb: number;
  edge: number;
  ev: number;
  odds: number;
  kelly: number;
  value: boolean;
}

export interface GameAnalysis {
  /** Raw power-rating model. */
  raw: GameModel;
  /** Market-blended model used for probabilities. */
  model: GameModel;
  spread: MarketEdge;
  total: MarketEdge;
  moneyline: MarketEdge;
  best: MarketEdge;
}

/** Points lost for missing starters (QB matters most). */
export function injuryAdjustment(teamId: string, players: Player[]) {
  let adj = 0;
  for (const p of players) {
    if (p.team !== teamId || p.depth !== 1) continue;
    const out = p.injury.status === 'O' || p.injury.status === 'IR' || p.injury.status === 'PUP' ? 1 : p.injury.status === 'D' ? 0.75 : p.injury.status === 'Q' ? 0.2 : 0;
    if (!out) continue;
    const w = p.position === 'QB' ? 6 : p.position === 'RB' ? 0.8 : p.position === 'WR' ? 1.1 : p.position === 'TE' ? 0.6 : 0;
    adj += w * out * (0.5 + p.talent * 0.6);
  }
  return adj;
}

export function modelGame(game: Game, home: Team, away: Team, players: Player[]): GameModel {
  const paceAdj = ((home.pace + away.pace) / 2 - 63.5) * 0.55;
  const weather = game.weather.condition === 'Wind' || game.weather.condition === 'Snow' ? -2.5 : game.weather.condition === 'Rain' ? -1.2 : 0;
  const homePts = 22.4 + home.offRating - away.defRating + 1.2 + paceAdj / 2 + weather / 2 - injuryAdjustment(home.id, players);
  const awayPts = 22.4 + away.offRating - home.defRating - 1.2 + paceAdj / 2 + weather / 2 - injuryAdjustment(away.id, players);
  return { homePts, awayPts, margin: homePts - awayPts, total: homePts + awayPts };
}

function edge(label: string, side: string, modelProb: number, odds: number, otherOdds: number): MarketEdge {
  const [fair] = noVig(odds, otherOdds);
  const e = modelProb - fair;
  return { label, side, modelProb, marketProb: fair, edge: e, ev: expectedValue(modelProb, odds), odds, kelly: kellyUnits(modelProb, odds), value: e >= VALUE_EDGE };
}

export function analyzeGame(game: Game, odds: GameOdds, home: Team, away: Team, players: Player[]): GameAnalysis {
  const raw = modelGame(game, home, away, players);
  const w = MODEL_WEIGHT.game;
  const margin = -odds.spread + w * (raw.margin + odds.spread);
  const total = odds.total + w * (raw.total - odds.total);
  const model: GameModel = { margin, total, homePts: (total + margin) / 2, awayPts: (total - margin) / 2 };
  const pHomeCover = coverProb(model.margin, odds.spread);
  const homeSpread = edge(`${home.id} ${odds.spread > 0 ? '+' : ''}${odds.spread}`, home.id, pHomeCover, -110, -110);
  const awaySpread = edge(`${away.id} ${-odds.spread > 0 ? '+' : ''}${-odds.spread}`, away.id, 1 - pHomeCover, -110, -110);
  const pOver = overProb(model.total, odds.total);
  const over = edge(`Over ${odds.total}`, 'over', pOver, -110, -110);
  const under = edge(`Under ${odds.total}`, 'under', 1 - pOver, -110, -110);
  const pHome = winProb(model.margin);
  const homeMl = edge(`${home.id} ML`, home.id, pHome, odds.homeMl, odds.awayMl);
  const awayMl = edge(`${away.id} ML`, away.id, 1 - pHome, odds.awayMl, odds.homeMl);
  const spread = homeSpread.edge >= awaySpread.edge ? homeSpread : awaySpread;
  const totalEdge = over.edge >= under.edge ? over : under;
  const moneyline = homeMl.edge >= awayMl.edge ? homeMl : awayMl;
  const best = [spread, totalEdge, moneyline].sort((a, b) => b.edge - a.edge)[0];
  return { raw, model, spread, total: totalEdge, moneyline, best };
}

export interface PropAnalysis {
  prop: PlayerProp;
  projection: number;
  pOver: number;
  side: 'over' | 'under';
  edge: number;
  odds: number;
  value: boolean;
}

const PROP_SD: Record<string, (m: number) => number> = {
  passYds: (m) => 0.2 * m + 22,
  passTd: () => 0.95,
  rushYds: (m) => 0.38 * m + 9,
  recYds: (m) => 0.48 * m + 8,
  rec: (m) => 0.35 * m + 1.1,
};

export function analyzeProp(prop: PlayerProp, player: Player, opp: Team | undefined): PropAnalysis {
  const p = player.projection;
  const mf = opp && player.position !== 'K' && player.position !== 'DST' ? matchupMultiplier(opp.defVsPos[player.position]) : 1;
  const avail = player.injury.status === 'Q' ? 0.93 : 1;
  const raw = { passYds: p.passYds, passTd: p.passTd, rushYds: p.rushYds, recYds: p.recYds, rec: p.rec, anytimeTd: p.rushTd + p.recTd }[prop.market];
  const rawProj = raw * mf * avail;
  // Shrink toward the market line (anytime-TD lines carry no yardage anchor).
  const projection = prop.market === 'anytimeTd' || prop.market === 'passTd' ? rawProj : prop.line + MODEL_WEIGHT.prop * (rawProj - prop.line);
  let pOver: number;
  if (prop.market === 'anytimeTd') pOver = 1 - Math.exp(-projection);
  else if (prop.market === 'passTd') pOver = 1 - Math.exp(-projection) * (1 + projection);
  else pOver = 1 - normCdf((prop.line - projection) / PROP_SD[prop.market](projection));
  pOver = clamp(pOver, 0.02, 0.98);
  const [fairOver, fairUnder] = noVig(prop.overOdds, prop.underOdds);
  const overEdge = pOver - fairOver;
  const underEdge = 1 - pOver - fairUnder;
  const side = prop.market === 'anytimeTd' || overEdge >= underEdge ? 'over' : 'under';
  const e = side === 'over' ? overEdge : underEdge;
  return { prop, projection, pOver, side, edge: e, odds: side === 'over' ? prop.overOdds : prop.underOdds, value: e >= VALUE_EDGE };
}

export { impliedProb };
