/**
 * Sleeper API adapter (no key required). https://docs.sleeper.com
 * Used for: league import, rosters, trending adds and player headshots.
 */
import { cachedGet } from '../http';
import type { DraftPick, League, LeagueMode, LeagueTeam, Player, Position, Slot, TrendingPlayer } from '../types';
import type { CoreData, DataSource } from './types';
import { emptyStats } from '../mock/generate';

const BASE = 'https://api.sleeper.app/v1';
const HOUR = 3600_000;

export const headshotUrl = (sleeperId: string) => `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[.'’`-]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ───── Raw API types (subset) ───── */
interface SleeperUser { user_id: string; display_name: string; avatar?: string; metadata?: { team_name?: string } }
export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: { type?: number; num_teams?: number; keeper_count?: number };
  avatar?: string;
}
interface SleeperRoster { roster_id: number; owner_id: string | null; players: string[] | null; settings: { wins?: number; losses?: number; ties?: number } }
interface SleeperTradedPick { season: string; round: number; roster_id: number; owner_id: number }
interface SleeperPlayerRaw { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string | null; age?: number; years_exp?: number; injury_status?: string | null; active?: boolean }

/** Compact index: [sleeperId, normalizedName, position, team, age, fullName, yearsExp] */
type IndexRow = [string, string, string, string, number, string, number];

let indexPromise: Promise<IndexRow[]> | null = null;
const INDEX_KEY = 'ge:sleeper-index:v1';

/** The full players endpoint is ~5 MB; we fetch it at most daily and keep a compact index in localStorage. */
export async function playerIndex(): Promise<IndexRow[]> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; rows: IndexRow[] };
        if (Date.now() - parsed.at < 24 * HOUR) return parsed.rows;
      }
    } catch {
      /* ignore */
    }
    const { data } = await cachedGet<Record<string, SleeperPlayerRaw>>(`${BASE}/players/nfl`, { ttlMs: 24 * HOUR });
    const rows: IndexRow[] = [];
    for (const [id, p] of Object.entries(data)) {
      if (!p.position || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) continue;
      if (p.active === false && !p.team) continue;
      const full = p.full_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
      rows.push([id, normalizeName(full), p.position === 'DEF' ? 'DST' : p.position, p.team ?? 'FA', p.age ?? 0, full, p.years_exp ?? 0]);
    }
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify({ at: Date.now(), rows }));
    } catch {
      /* quota — keep in memory only */
    }
    return rows;
  })();
  indexPromise.catch(() => (indexPromise = null));
  return indexPromise;
}

/** Map Sleeper ids ⇄ our player ids by normalized name + position. */
export async function sleeperIdMap(players: Player[]) {
  const rows = await playerIndex();
  const byKey = new Map<string, IndexRow>();
  rows.forEach((r) => byKey.set(`${r[1]}|${r[2]}`, r));
  const toSleeper = new Map<string, string>();
  const fromSleeper = new Map<string, string>();
  for (const p of players) {
    if (p.position === 'DST') {
      toSleeper.set(p.id, p.team);
      fromSleeper.set(p.team, p.id);
      continue;
    }
    const hit = byKey.get(`${normalizeName(p.name)}|${p.position}`);
    if (hit) {
      toSleeper.set(p.id, hit[0]);
      fromSleeper.set(hit[0], p.id);
    }
  }
  return { toSleeper, fromSleeper, rows };
}

/** Attach Sleeper ids + headshots to the core dataset. */
export async function enrichWithSleeper(core: CoreData): Promise<CoreData> {
  const { toSleeper } = await sleeperIdMap(core.players);
  return {
    ...core,
    players: core.players.map((p) => {
      const sid = toSleeper.get(p.id);
      if (!sid) return p;
      return { ...p, sleeperId: sid, headshotUrl: p.position === 'DST' ? `https://sleepercdn.com/images/team_logos/nfl/${sid.toLowerCase()}.png` : headshotUrl(sid) };
    }),
  };
}

export const sleeperSource: DataSource = {
  id: 'sleeper',
  label: 'Sleeper',
  async getTrending(core) {
    const { data } = await cachedGet<{ player_id: string; count: number }[]>(`${BASE}/players/nfl/trending/add?lookback_hours=24&limit=40`, { ttlMs: 30 * 60_000, persist: true });
    const { fromSleeper } = await sleeperIdMap(core.players);
    const out: TrendingPlayer[] = [];
    for (const t of data) {
      const id = fromSleeper.get(t.player_id);
      if (!id) continue;
      out.push({ playerId: id, adds: t.count, drops: 0, rosterPct: 0, rosterPctDelta: 0 });
    }
    if (!out.length) throw new Error('No trending players matched');
    return out;
  },
};

/* ───────────────────────────── League import ───────────────────────────── */

export async function fetchUser(username: string) {
  const { data } = await cachedGet<SleeperUser | null>(`${BASE}/user/${encodeURIComponent(username.trim())}`, { ttlMs: HOUR });
  if (!data) throw new Error(`No Sleeper user named "${username}"`);
  return data;
}

export async function fetchUserLeagues(userId: string, season: number) {
  const { data } = await cachedGet<SleeperLeague[]>(`${BASE}/user/${userId}/leagues/nfl/${season}`, { ttlMs: 10 * 60_000 });
  return data ?? [];
}

const SLOT_MAP: Record<string, Slot | undefined> = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', FLEX: 'FLEX', SUPER_FLEX: 'SUPERFLEX', K: 'K', DEF: 'DST' };

/**
 * Import a Sleeper league into the app's league model. Players we don't model are added
 * as lightweight "extra" players so rosters stay complete.
 */
export async function importSleeperLeague(leagueId: string, myUserId: string, universe: Player[]): Promise<{ league: League; extraPlayers: Player[]; unmatched: number }> {
  const [{ data: lg }, { data: rosters }, { data: users }, { data: traded }] = await Promise.all([
    cachedGet<SleeperLeague>(`${BASE}/league/${leagueId}`, { ttlMs: 5 * 60_000, force: true }),
    cachedGet<SleeperRoster[]>(`${BASE}/league/${leagueId}/rosters`, { ttlMs: 5 * 60_000, force: true }),
    cachedGet<SleeperUser[]>(`${BASE}/league/${leagueId}/users`, { ttlMs: 5 * 60_000, force: true }),
    cachedGet<SleeperTradedPick[]>(`${BASE}/league/${leagueId}/traded_picks`, { ttlMs: 5 * 60_000, force: true }),
  ]);
  const { fromSleeper, rows } = await sleeperIdMap(universe);
  const rowById = new Map(rows.map((r) => [r[0], r]));
  const extraPlayers: Player[] = [];
  let unmatched = 0;

  const slots: Record<Slot, number> = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, SUPERFLEX: 0, K: 0, DST: 0 };
  for (const rp of lg.roster_positions) {
    const s = SLOT_MAP[rp];
    if (s) slots[s]++;
    else if (rp === 'REC_FLEX' || rp === 'WRRB_FLEX') slots.FLEX++;
  }
  const sc = lg.scoring_settings ?? {};
  const mode: LeagueMode = lg.settings?.type === 2 ? 'dynasty' : lg.settings?.type === 1 ? 'keeper' : 'redraft';
  const season = Number(lg.season);
  const userById = new Map(users.map((u) => [u.user_id, u]));

  const mapPlayer = (sid: string): string | null => {
    const ours = fromSleeper.get(sid);
    if (ours) return ours;
    const row = rowById.get(sid);
    if (!row || !['QB', 'RB', 'WR', 'TE', 'K'].includes(row[2])) return null;
    unmatched++;
    const id = `slp-${sid}`;
    if (!extraPlayers.some((p) => p.id === id)) {
      const proj = emptyStats();
      if (row[2] === 'K') proj.kPts = 6.5;
      else if (row[2] === 'QB') Object.assign(proj, { passAtt: 6, passCmp: 4, passYds: 40, passTd: 0.2, int: 0.15 });
      else if (row[2] === 'RB') Object.assign(proj, { rushAtt: 3, rushYds: 12, rushTd: 0.08, targets: 1, rec: 0.8, recYds: 6 });
      else Object.assign(proj, { targets: 1.6, rec: 1, recYds: 11, recTd: 0.06 });
      extraPlayers.push({
        id, name: row[5], position: row[2] as Position, team: row[3], age: row[4] || 25, experience: row[6], draft: null, contractYearsLeft: 1,
        injury: { status: 'HEALTHY', risk: 0.05 }, depth: 3, projection: proj,
        usage: { snapPct: 0.15, routePct: 0.1, targetShare: 0.03, carryShare: 0.05, airYardsShare: 0.02, redZoneShare: 0.02, aDot: 7 },
        talent: 0.25, sleeperId: sid, headshotUrl: headshotUrl(sid),
      });
    }
    return id;
  };

  const teams: LeagueTeam[] = rosters.map((r) => {
    const u = r.owner_id ? userById.get(r.owner_id) : undefined;
    return {
      id: String(r.roster_id),
      name: u?.metadata?.team_name || (u ? `Team ${u.display_name}` : `Team ${r.roster_id}`),
      owner: u?.display_name ?? 'Open slot',
      playerIds: (r.players ?? []).map(mapPlayer).filter(Boolean) as string[],
      picks: [],
      record: { w: r.settings?.wins ?? 0, l: r.settings?.losses ?? 0, t: r.settings?.ties ?? 0 },
    };
  });

  // Draft picks: every team owns its own for the next 3 drafts, then apply trades.
  const rounds = mode === 'dynasty' ? 4 : mode === 'keeper' ? 3 : 0;
  if (rounds) {
    const own = new Map<string, DraftPick & { owner: string }>();
    for (let y = 1; y <= 3; y++) {
      for (let rd = 1; rd <= rounds; rd++) {
        for (const t of teams) own.set(`${season + y}-${rd}-${t.id}`, { id: `pk-${season + y}-${rd}-${t.id}`, season: season + y, round: rd, originalTeamId: t.id, owner: t.id });
      }
    }
    for (const tp of traded) {
      const k = `${tp.season}-${tp.round}-${tp.roster_id}`;
      const pk = own.get(k);
      if (pk) pk.owner = String(tp.owner_id);
    }
    for (const pk of own.values()) {
      const t = teams.find((x) => x.id === pk.owner);
      const { owner, ...pick } = pk;
      void owner;
      t?.picks.push(pick);
    }
  }

  const myRoster = rosters.find((r) => r.owner_id === myUserId);
  const now = Date.now();
  const league: League = {
    id: `sleeper-${lg.league_id}`,
    name: lg.name,
    platform: 'sleeper',
    externalId: lg.league_id,
    season,
    mode,
    superflex: slots.SUPERFLEX > 0 || slots.QB > 1,
    scoring: {
      ppr: (sc.rec ?? 0) >= 1 ? 1 : (sc.rec ?? 0) >= 0.5 ? 0.5 : 0,
      tePremium: sc.bonus_rec_te ?? 0,
      passTd: (sc.pass_td ?? 4) >= 6 ? 6 : (sc.pass_td ?? 4) >= 5 ? 5 : 4,
      passYd: sc.pass_yd ?? 0.04,
      int: sc.pass_int ?? -2,
    },
    teams: lg.total_rosters,
    rosterSize: lg.roster_positions.length,
    slots,
    keepers: lg.settings?.keeper_count,
    strategy: 'balanced',
    myTeamId: myRoster ? String(myRoster.roster_id) : teams[0]?.id ?? '1',
    rosters: teams,
    createdAt: now,
    updatedAt: now,
    extraPlayers,
  };
  return { league, extraPlayers, unmatched };
}
