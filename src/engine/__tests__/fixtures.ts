import { getMockDataset } from '@/data/mock/generate';
import type { League, LeagueTeam, Player, Slot } from '@/data/types';
import { buildContext, valueUniverse, type ValuationLeague } from '../valuation';

/** Fixed clock: Sunday of Week 5, 2026. */
export const NOW = Date.UTC(2026, 9, 11, 16);
export const data = getMockDataset(NOW);
export const playersById = new Map(data.players.map((p) => [p.id, p]));

export const STD_SLOTS: Record<Slot, number> = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 };

export function league(over: Partial<ValuationLeague> = {}): ValuationLeague {
  return {
    mode: 'redraft',
    superflex: false,
    scoring: { ppr: 0.5, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 },
    teams: 12,
    slots: STD_SLOTS,
    strategy: 'balanced',
    ...over,
  };
}

export function universe(over: Partial<ValuationLeague> = {}, players: Player[] = data.players) {
  return valueUniverse(players, buildContext(league(over), data));
}

export function clone(p: Player, over: Partial<Player>): Player {
  return { ...structuredClone(p), ...over };
}

export const P = (id: string) => {
  const p = playersById.get(id);
  if (!p) throw new Error(`fixture player missing: ${id}`);
  return p;
};

export function rosters(): LeagueTeam[] {
  return [
    { id: 'me', name: 'Me', owner: 'me', playerIds: ['jahmyr-gibbs', 'ja-marr-chase', 'josh-allen', 'brock-bowers', 'derrick-henry', 'garrett-wilson', 'zay-flowers', 'chase-brown', 'brandon-aubrey', 'den-dst'], picks: [
      { id: 'me-2027-1', season: 2027, round: 1, originalTeamId: 'me' },
      { id: 'me-2027-2', season: 2027, round: 2, originalTeamId: 'me' },
    ] },
    { id: 'them', name: 'Them', owner: 'them', playerIds: ['bijan-robinson', 'puka-nacua', 'lamar-jackson', 'trey-mcbride', 'kyren-williams', 'drake-london', 'tee-higgins', 'james-cook', 'cameron-dicker', 'sea-dst', 'jeremiyah-love', 'nico-collins'], picks: [
      { id: 'them-2027-1', season: 2027, round: 1, originalTeamId: 'them' },
      { id: 'them-2028-1', season: 2028, round: 1, originalTeamId: 'them' },
      { id: 'them-2027-3', season: 2027, round: 3, originalTeamId: 'them' },
    ] },
  ];
}

export type { League };
