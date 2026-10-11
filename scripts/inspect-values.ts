import { getMockDataset } from '../src/data/mock/generate';
import { buildContext, valueUniverse } from '../src/engine/valuation';
import type { League } from '../src/data/types';

const d = getMockDataset();
const base: Pick<League, 'mode' | 'superflex' | 'scoring' | 'teams' | 'slots' | 'strategy'> = {
  mode: 'redraft', superflex: false, scoring: { ppr: 0.5, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 }, teams: 12,
  slots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 }, strategy: 'balanced',
};
const mode = (process.argv[2] ?? 'redraft') as League['mode'];
const sf = process.argv[3] === 'sf';
const u = valueUniverse(d.players, buildContext({ ...base, mode, superflex: sf }, d));
const byId = new Map(d.players.map((p) => [p.id, p]));
console.log('week', d.week, 'refs', u.refs, 'repl', u.replacement.season);
for (const v of u.ranked.slice(0, 60)) {
  const p = byId.get(v.playerId)!;
  console.log(String(v.overallRank).padStart(3), p.position + v.posRank, p.name.padEnd(24), p.age, 'ppg', v.ppg.toFixed(1), 'R', Math.round(v.redraftValue), 'D', Math.round(v.dynastyValue), 'K', Math.round(v.keeperValue), 'wk', v.week.mean.toFixed(1));
}
