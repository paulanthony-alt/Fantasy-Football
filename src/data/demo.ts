/**
 * Demo leagues and bets so the app is fully populated on first launch.
 * Rosters come from a simulated snake draft priced by the league's own valuations.
 */
import type { Bet, DraftPick, League, LeagueTeam, Position, Slot } from './types';
import type { CoreData } from './sources/types';
import { buildContext, valueUniverse } from '@/engine/valuation';
import { hashString, rng } from '@/lib/utils';

const TEAM_NAMES = [
  'Hail Mary Hustlers', 'Fourth & Long Shots', 'Blitzkrieg Bop', 'The Audibles', 'Red Zone Rebels', 'Pick Six Syndicate',
  'Two-Minute Warning', 'Neutral Zone Infraction', 'Cover 2 Collective', 'Hard Count Heroes', 'Waiver Wire Wizards', 'Play Action Packers',
];
const OWNERS = ['mike_g', 'jstrat', 'kels', 'dmoney', 'brandon.k', 'tfleet', 'nora_fs', 'chen22', 'rob.ross', 'ana_p', 'stackz', 'you'];

interface DemoSpec {
  id: string;
  name: string;
  mode: League['mode'];
  superflex: boolean;
  scoring: League['scoring'];
  slots: Record<Slot, number>;
  rosterSize: number;
  myIndex: number;
  strategy: League['strategy'];
}

const SPECS: DemoSpec[] = [
  {
    id: 'demo-redraft', name: 'Sunday Night Legends', mode: 'redraft', superflex: false,
    scoring: { ppr: 0.5, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 },
    slots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 }, rosterSize: 16, myIndex: 4, strategy: 'win-now',
  },
  {
    id: 'demo-dynasty', name: 'Dynasty Syndicate', mode: 'dynasty', superflex: true,
    scoring: { ppr: 1, tePremium: 0.5, passTd: 4, passYd: 0.04, int: -2 },
    slots: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2, SUPERFLEX: 1, K: 0, DST: 0 }, rosterSize: 26, myIndex: 7, strategy: 'balanced',
  },
  {
    id: 'demo-keeper', name: 'Office Keeper League', mode: 'keeper', superflex: false,
    scoring: { ppr: 1, tePremium: 0, passTd: 6, passYd: 0.04, int: -2 },
    slots: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 }, rosterSize: 18, myIndex: 2, strategy: 'balanced',
  },
];

function caps(spec: DemoSpec): Record<Position, number> {
  return {
    QB: spec.superflex ? 4 : 2,
    RB: Math.round(spec.rosterSize * 0.34),
    WR: Math.round(spec.rosterSize * 0.38),
    TE: spec.rosterSize > 20 ? 3 : 2,
    K: spec.slots.K,
    DST: spec.slots.DST,
  };
}

export function buildDemoLeague(spec: DemoSpec, core: CoreData): League {
  const teams = 12;
  const u = valueUniverse(core.players, buildContext({ mode: spec.mode, superflex: spec.superflex, scoring: spec.scoring, teams, slots: spec.slots, strategy: 'balanced' }, core));
  const r = rng(hashString(spec.id));
  const pool = u.ranked.filter((v) => v.value > 0).map((v) => ({ id: v.playerId, pos: v.position, value: v.value }));
  const taken = new Set<string>();
  const rosters: LeagueTeam[] = Array.from({ length: teams }, (_, i) => ({
    id: `t${i + 1}`,
    name: i === spec.myIndex ? 'Gridiron Edge' : TEAM_NAMES[i],
    owner: i === spec.myIndex ? 'you' : OWNERS[i],
    playerIds: [],
    picks: [],
  }));
  const limit = caps(spec);
  for (let round = 0; round < spec.rosterSize; round++) {
    const order = round % 2 === 0 ? rosters : [...rosters].reverse();
    for (const team of order) {
      const counts: Partial<Record<Position, number>> = {};
      team.playerIds.forEach((id) => {
        const pos = pool.find((p) => p.id === id)!.pos;
        counts[pos] = (counts[pos] ?? 0) + 1;
      });
      const lateRounds = round >= spec.rosterSize - 2;
      const options = pool
        .filter((p) => !taken.has(p.id) && (counts[p.pos] ?? 0) < limit[p.pos])
        .filter((p) => (p.pos === 'K' || p.pos === 'DST' ? lateRounds : true))
        .slice(0, 4);
      if (!options.length) continue;
      // Mostly best available, sometimes a reach
      const roll = r();
      const pick = options[roll < 0.62 ? 0 : roll < 0.85 ? 1 : roll < 0.95 ? 2 : Math.min(3, options.length - 1)] ?? options[0];
      taken.add(pick.id);
      team.playerIds.push(pick.id);
    }
  }
  // Records through last week
  const played = core.week - 1;
  rosters.forEach((t) => {
    const w = Math.round(r() * played);
    t.record = { w, l: played - w };
  });
  // Picks for dynasty / keeper
  if (spec.mode !== 'redraft') {
    const rounds = spec.mode === 'dynasty' ? 4 : 2;
    for (let y = 1; y <= 3; y++) {
      for (let rd = 1; rd <= rounds; rd++) {
        rosters.forEach((t) => t.picks.push({ id: `${spec.id}-${core.season + y}-${rd}-${t.id}`, season: core.season + y, round: rd, originalTeamId: t.id } satisfies DraftPick));
      }
    }
    // A couple of historical pick trades so pick ownership looks lived-in
    const move = (from: number, to: number, idx: number) => {
      const p = rosters[from].picks.splice(idx, 1)[0];
      if (p) rosters[to].picks.push(p);
    };
    move(1, spec.myIndex, 0);
    move(9, 3, 1);
    move(spec.myIndex, 5, rosters[spec.myIndex].picks.length - 1);
  }
  const now = Date.now();
  return {
    id: spec.id,
    name: spec.name,
    platform: 'demo',
    season: core.season,
    mode: spec.mode,
    superflex: spec.superflex,
    scoring: spec.scoring,
    teams,
    rosterSize: spec.rosterSize,
    slots: spec.slots,
    keepers: spec.mode === 'keeper' ? 3 : undefined,
    strategy: spec.strategy,
    myTeamId: rosters[spec.myIndex].id,
    rosters,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildDemoLeagues(core: CoreData): League[] {
  return SPECS.map((s) => buildDemoLeague(s, core));
}

export function demoBets(now = Date.now()): Bet[] {
  const day = 86400000;
  const rows: [number, Bet['type'], string, number, number, Bet['result'], string, number][] = [
    [34, 'spread', 'BUF −3.5 vs MIA', -110, 1, 'win', 'DraftKings', 0.041],
    [33, 'total', 'DET/GB Over 48.5', -110, 1, 'loss', 'FanDuel', 0.032],
    [33, 'prop', 'Ja\'Marr Chase o78.5 rec yds', -115, 0.5, 'win', 'BetMGM', 0.052],
    [27, 'moneyline', 'DEN ML vs KC', 135, 1, 'win', 'Caesars', 0.046],
    [27, 'spread', 'SEA +2.5 at LAR', -110, 1, 'push', 'DraftKings', 0.03],
    [26, 'prop', 'Bijan Robinson anytime TD', -140, 1, 'win', 'FanDuel', 0.038],
    [20, 'total', 'NYJ/NE Under 41.5', -105, 1, 'win', 'BetMGM', 0.044],
    [20, 'spread', 'CIN −6.5 vs CLE', -110, 1.5, 'loss', 'DraftKings', 0.035],
    [19, 'prop', 'Brock Bowers o5.5 rec', 120, 0.5, 'loss', 'Caesars', 0.061],
    [13, 'moneyline', 'WAS ML at PHI', 165, 0.75, 'loss', 'FanDuel', 0.05],
    [13, 'spread', 'HOU +3 vs BAL', -115, 1, 'win', 'DraftKings', 0.033],
    [12, 'prop', 'Josh Allen o1.5 pass TD', -130, 1, 'win', 'BetMGM', 0.036],
    [6, 'total', 'LAC/DEN Under 44', -110, 1, 'win', 'FanDuel', 0.039],
    [6, 'parlay', 'DET ML + SF ML', 180, 0.5, 'loss', 'DraftKings', 0],
    [5, 'prop', 'Puka Nacua o6.5 rec', -105, 1, 'win', 'Caesars', 0.047],
    [1, 'spread', 'ATL +4.5 vs TB', -110, 1, 'pending', 'DraftKings', 0.04],
  ];
  return rows.map(([d, type, description, odds, units, result, book, edge], i) => ({ id: `demo-bet-${i}`, placedAt: now - d * day, type, description, odds, units, result, book, edge }));
}
