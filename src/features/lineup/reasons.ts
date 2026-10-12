import type { GameLog, GameOdds } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import type { LineupPlayer } from '@/hooks/useLineup';
import { impliedTotals, recentTrend } from '@/lib/stats';
import { fmt } from '@/lib/format';

export interface Reason {
  tone: 'pos' | 'neg' | 'neutral';
  text: string;
}

export function impliedFor(u: UniverseState, team: string, odds?: GameOdds[]) {
  const g = u.core.games.find((x) => x.week === u.core.week && (x.home === team || x.away === team));
  const o = g && odds?.find((x) => x.gameId === g.id);
  if (!g || !o) return null;
  const it = impliedTotals(o.spread, o.total);
  return { total: g.home === team ? it.home : it.away, game: g };
}

/** Plain-English reasons behind a projection. */
export function reasonsFor(u: UniverseState, e: LineupPlayer, logs: GameLog[] | undefined, odds?: GameOdds[]): Reason[] {
  const out: Reason[] = [];
  const p = e.player;
  const w = e.val.week;
  if (w.bye) return [{ tone: 'neg', text: `${p.team} is on bye in Week ${u.core.week}.` }];
  if (p.injury.status !== 'HEALTHY') out.push({ tone: 'neg', text: `Injury: ${p.injury.status === 'Q' ? 'questionable' : p.injury.status === 'D' ? 'doubtful' : 'out'}${p.injury.detail ? ` (${p.injury.detail.split('—')[0].trim().toLowerCase()})` : ''} — projection discounted.` });
  if (w.matchupRank) {
    const r = w.matchupRank;
    if (r >= 23) out.push({ tone: 'pos', text: `Soft matchup: ${w.opp} rank ${r}/32 vs ${p.position} (higher = more points allowed).` });
    else if (r <= 10) out.push({ tone: 'neg', text: `Tough matchup: ${w.opp} rank ${r}/32 vs ${p.position}.` });
    else out.push({ tone: 'neutral', text: `Neutral matchup: ${w.opp} rank ${r}/32 vs ${p.position}.` });
  }
  const it = impliedFor(u, p.team, odds);
  if (it) out.push({ tone: it.total >= 25 ? 'pos' : it.total <= 19 ? 'neg' : 'neutral', text: `${p.team} implied for ${fmt.num(it.total)} points${it.total >= 25 ? ' — a top scoring environment' : it.total <= 19 ? ' — a low-scoring script' : ''}.` });
  if (logs && logs.length >= 3) {
    const tr = recentTrend(logs, p.position, u.league.scoring);
    if (Math.abs(tr.delta) >= 1.5) out.push({ tone: tr.delta > 0 ? 'pos' : 'neg', text: `${tr.delta > 0 ? 'Trending up' : 'Cooling off'}: ${fmt.num(tr.recent)} ppg last 3 vs ${fmt.num(tr.season)} season.` });
  }
  const game = it?.game;
  if (game && game.weather.condition !== 'Dome' && (['Rain', 'Snow', 'Wind'].includes(game.weather.condition) || game.weather.windMph >= 15)) {
    out.push({ tone: p.position === 'RB' || p.position === 'DST' ? 'neutral' : 'neg', text: `Weather: ${game.weather.condition.toLowerCase()}, ${game.weather.windMph} mph wind, ${game.weather.tempF}°F.` });
  }
  return out;
}
