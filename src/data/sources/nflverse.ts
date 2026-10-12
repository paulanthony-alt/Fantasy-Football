/**
 * nflverse adapter — weekly player stats from the public nflverse-data release CSVs.
 * Opt-in (Settings → Data) because the season file is a few MB.
 */
import { cachedGet } from '../http';
import type { GameLog, StatLine } from '../types';
import type { CoreData, DataSource } from './types';
import { normalizeName } from './sleeper';
import { emptyStats } from '../mock/generate';

const url = (season: number) => `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`;

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',').map((h) => h.replace(/"/g, ''));
  return lines.slice(1).map((l) => {
    const cells = l.split(',');
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = (cells[i] ?? '').replace(/"/g, '')));
    return row;
  });
}

const num = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== '' && r[k] !== 'NA') return Number(r[k]) || 0;
  return 0;
};

let rowsPromise: Promise<Record<string, string>[]> | null = null;

export const nflverseSource: DataSource = {
  id: 'nflverse',
  label: 'nflverse',
  async getGameLogs(playerId: string, core: CoreData) {
    rowsPromise ??= cachedGet<string>(url(core.season), { ttlMs: 6 * 3600_000, parse: 'text' }).then((r) => parseCsv(r.data));
    const rows = await rowsPromise.catch((e) => {
      rowsPromise = null;
      throw e;
    });
    const player = core.players.find((p) => p.id === playerId);
    if (!player) return [];
    const target = normalizeName(player.name);
    const mine = rows.filter((r) => normalizeName(r.player_display_name || r.player_name || '') === target && (r.season_type ?? 'REG') === 'REG');
    if (!mine.length) throw new Error('Player not found in nflverse');
    return mine.map((r): GameLog => {
      const s: StatLine = {
        ...emptyStats(),
        passAtt: num(r, 'attempts'), passCmp: num(r, 'completions'), passYds: num(r, 'passing_yards'), passTd: num(r, 'passing_tds'),
        int: num(r, 'passing_interceptions', 'interceptions'), rushAtt: num(r, 'carries'), rushYds: num(r, 'rushing_yards'), rushTd: num(r, 'rushing_tds'),
        targets: num(r, 'targets'), rec: num(r, 'receptions'), recYds: num(r, 'receiving_yards'), recTd: num(r, 'receiving_tds'),
        fumLost: num(r, 'rushing_fumbles_lost') + num(r, 'receiving_fumbles_lost') + num(r, 'sack_fumbles_lost'),
      };
      const week = num(r, 'week');
      const opp = r.opponent_team || r.opponent || '';
      const game = core.games.find((g) => g.week === week && (g.home === opp || g.away === opp));
      return {
        week, gameId: game?.id ?? `${core.season}-w${week}`, opponent: opp, home: game ? game.home !== opp : true, teamScore: 0, oppScore: 0,
        weather: game?.weather ?? { condition: 'Clear', tempF: 65, windMph: 5 },
        oppRankVsPos: 16, stats: s, snapPct: 0, routes: 0, airYards: num(r, 'receiving_air_yards'), redZoneTouches: 0, projectedFactor: 1,
      };
    });
  },
};
