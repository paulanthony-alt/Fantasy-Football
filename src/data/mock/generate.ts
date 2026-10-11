import type {
  Game, GameLog, GameOdds, LinePoint, NewsItem, Player, PlayerProp, PropMarket, StatLine, Team, TrendingPlayer, Weather, WeatherCondition,
} from '../types';
import { buildTeams } from './teams';
import { SEED_INJURIES, SEED_KICKERS, SEED_PLAYERS } from './roster';
import { clamp, gauss, hashString, normCdf, rng, round } from '@/lib/utils';
import { americanFromProb } from '@/engine/betting/odds';

export const SEASON = 2026;
/** Tuesday before week 1 — weeks roll over every Tuesday. */
const SEASON_ANCHOR = Date.UTC(2026, 8, 8, 12);
export const REG_SEASON_WEEKS = 18;

/** Current NFL week (upcoming slate). Clamped so there is always history and remaining schedule. */
export function currentWeek(now = Date.now()) {
  const w = Math.floor((now - SEASON_ANCHOR) / (7 * 86400000)) + 1;
  return clamp(w, 2, 17);
}

export function emptyStats(): StatLine {
  return { passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, int: 0, rushAtt: 0, rushYds: 0, rushTd: 0, targets: 0, rec: 0, recYds: 0, recTd: 0, fumLost: 0 };
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export interface MockDataset {
  season: number;
  week: number;
  teams: Team[];
  players: Player[];
  games: Game[];
  logs: Record<string, GameLog[]>;
  odds: GameOdds[];
  props: PlayerProp[];
  news: NewsItem[];
  trending: TrendingPlayer[];
  generatedAt: number;
}

/* ───────────────────────────── Players ───────────────────────────── */

function projectSkill(row: (typeof SEED_PLAYERS)[number], team: Team): { proj: StatLine; usage: Player['usage'] } {
  const [, pos, , , , t, , , , depth, x] = row;
  const tf = 1 + team.offRating / 40;
  const p = emptyStats();
  const d = depth === 1 ? 0.92 : 0.7;
  const teamPass = 31 + (team.passRate - 0.56) * 40 + (team.pace - 63) * 0.5;
  const usage: Player['usage'] = { snapPct: 0, routePct: 0, targetShare: 0, carryShare: 0, airYardsShare: 0, redZoneShare: 0, aDot: 0 };

  if (pos === 'QB') {
    const s = depth === 1 ? 1 : 0.04;
    p.passAtt = teamPass * s;
    p.passCmp = p.passAtt * (0.6 + 0.08 * t);
    p.passYds = (175 + 112 * t) * tf * s;
    p.passTd = (0.88 + 0.95 * t) * tf * s;
    p.int = (0.95 - 0.35 * t) * s;
    p.rushAtt = (2 + 7 * Math.max(x, 0)) * s;
    p.rushYds = p.rushAtt * (4.2 + 1.6 * x);
    p.rushTd = (0.04 + 0.26 * Math.max(0, x) * t) * s;
    p.fumLost = 0.12 * s;
    usage.snapPct = depth === 1 ? 0.99 : 0.03;
  } else if (pos === 'RB') {
    const recv = (x + 1) / 2;
    p.rushAtt = (7.5 + 12.5 * t) * d * (1 - 0.18 * recv);
    p.rushYds = p.rushAtt * (3.85 + 0.95 * t);
    p.rushTd = p.rushAtt * 0.031 * tf;
    p.targets = (1.4 + 3.6 * recv + 1.2 * t) * d;
    p.rec = p.targets * 0.78;
    p.recYds = p.rec * (7.2 + 1.2 * t);
    p.recTd = p.targets * 0.012;
    p.fumLost = 0.06 * d;
    usage.snapPct = clamp(0.28 + 0.5 * t * d + 0.08 * recv, 0.15, 0.86);
    usage.routePct = clamp(usage.snapPct * (0.45 + 0.4 * recv), 0.05, 0.7);
    usage.carryShare = p.rushAtt / 26;
    usage.targetShare = p.targets / teamPass;
    usage.aDot = 0.5 + recv;
  } else {
    const isTE = pos === 'TE';
    p.targets = (isTE ? 2.4 + 5.8 * t : 3.4 + 7.4 * t) * (depth === 1 ? 1 : 0.62) * (teamPass / 33);
    const catchRate = (isTE ? 0.71 : 0.6) + 0.09 * t - 0.06 * x;
    p.rec = p.targets * catchRate;
    p.recYds = p.rec * ((isTE ? 10.2 : 11.6) + 3.6 * x + 1.4 * t);
    p.recTd = p.targets * (isTE ? 0.054 : 0.05) * (1 + 0.15 * x) * tf;
    if (!isTE && x < -0.3) {
      p.rushAtt = 0.6;
      p.rushYds = 4.2;
    }
    p.fumLost = 0.03;
    usage.snapPct = clamp((isTE ? 0.55 : 0.6) + 0.35 * t * (depth === 1 ? 1 : 0.55), 0.3, 0.97);
    usage.routePct = clamp(usage.snapPct * (isTE ? 0.78 : 0.95), 0.2, 0.96);
    usage.targetShare = p.targets / teamPass;
    usage.aDot = isTE ? 6.8 + 2.4 * x : 9.8 + 4.6 * x;
    usage.airYardsShare = clamp(usage.targetShare * (usage.aDot / 8.4), 0.02, 0.5);
  }
  usage.redZoneShare = clamp((p.rushTd + p.recTd) * 0.42 + (pos === 'RB' ? 0.06 : 0), 0, 0.6);
  return { proj: p, usage };
}

function buildPlayers(teams: Team[]): Player[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const out: Player[] = [];
  for (const row of SEED_PLAYERS) {
    const [name, pos, team, age, exp, talent, contract, draftYear, draftRound, depth] = row;
    const tm = byId.get(team)!;
    const { proj, usage } = projectSkill(row, tm);
    const inj = SEED_INJURIES[name];
    const r = rng(hashString(name));
    out.push({
      id: slug(name),
      name,
      position: pos,
      team,
      age,
      experience: exp,
      draft: draftRound > 0 ? { year: draftYear, round: draftRound, pick: Math.round((draftRound - 1) * 32 + 1 + r() * 31) } : null,
      contractYearsLeft: contract,
      injury: inj ? { status: inj.status, detail: inj.detail, returnWeek: inj.returnWeek, risk: inj.risk } : { status: 'HEALTHY', risk: clamp(0.03 + (pos === 'RB' ? 0.03 : 0) + Math.max(0, age - 29) * 0.006, 0, 0.2) },
      depth,
      projection: proj,
      usage,
      talent,
    });
  }
  for (const [name, team, age, ppg] of SEED_KICKERS) {
    const s = emptyStats();
    s.kPts = ppg;
    out.push({
      id: slug(name), name, position: 'K', team, age, experience: Math.max(1, Math.round(age - 23)), draft: null, contractYearsLeft: 2,
      injury: { status: 'HEALTHY', risk: 0.01 }, depth: 1, projection: s,
      usage: { snapPct: 0, routePct: 0, targetShare: 0, carryShare: 0, airYardsShare: 0, redZoneShare: 0, aDot: 0 }, talent: clamp((ppg - 7) / 3.5, 0, 1),
    });
  }
  for (const t of teams) {
    const s = emptyStats();
    s.dstPts = round(6.4 + t.defRating * 0.55, 2);
    out.push({
      id: `${t.id.toLowerCase()}-dst`, name: `${t.name} D/ST`, position: 'DST', team: t.id, age: 0, experience: 0, draft: null, contractYearsLeft: 0,
      injury: { status: 'HEALTHY', risk: 0 }, depth: 1, projection: s,
      usage: { snapPct: 0, routePct: 0, targetShare: 0, carryShare: 0, airYardsShare: 0, redZoneShare: 0, aDot: 0 }, talent: clamp((t.defRating + 5) / 10, 0, 1),
    });
  }
  return out;
}

/* ───────────────────────────── Schedule ───────────────────────────── */

const NETWORKS = ['CBS', 'FOX', 'CBS', 'FOX', 'CBS', 'FOX', 'NBC', 'ESPN', 'Prime Video', 'NFL Network'];
const NORTH_COLD = new Set(['BUF', 'GB', 'CHI', 'CLE', 'PIT', 'NE', 'NYG', 'NYJ', 'DEN', 'KC', 'CIN', 'BAL', 'PHI', 'WAS', 'SEA']);

function weatherFor(home: Team, week: number, r: () => number): Weather {
  if (home.dome) return { condition: 'Dome', tempF: 72, windMph: 0 };
  const cold = NORTH_COLD.has(home.id);
  const base = (cold ? 72 : 80) - week * (cold ? 2.6 : 1.4);
  const tempF = Math.round(base + gauss(r, 0, 5));
  const roll = r();
  let condition: WeatherCondition = roll < 0.45 ? 'Clear' : roll < 0.72 ? 'Cloudy' : roll < 0.86 ? 'Rain' : 'Wind';
  if (condition === 'Rain' && tempF < 33) condition = 'Snow';
  const windMph = Math.round(condition === 'Wind' ? 15 + r() * 10 : 3 + r() * 9);
  return { condition, tempF, windMph };
}

function kickoffFor(week: number, idx: number, total: number) {
  // Thursday 8:15pm ET, Sunday 1:00 / 4:25 / 8:20pm ET, Monday 8:15pm ET (UTC-4 in Sept–Oct)
  const thursday = SEASON_ANCHOR + (week - 1) * 7 * 86400000 + 2 * 86400000;
  const day = (d: number, h: number, m: number) => new Date(thursday + d * 86400000 - 12 * 3600000 + (h + 4) * 3600000 + m * 60000).toISOString();
  if (idx === 0) return { kickoff: day(0, 20, 15), network: 'Prime Video' };
  if (idx === total - 1) return { kickoff: day(4, 20, 15), network: 'ESPN' };
  if (idx === total - 2) return { kickoff: day(3, 20, 20), network: 'NBC' };
  if (idx < total * 0.62) return { kickoff: day(3, 13, 0), network: NETWORKS[idx % 6] };
  return { kickoff: day(3, 16, 25), network: NETWORKS[idx % 6] };
}

function expectedPoints(home: Team, away: Team) {
  const h = 22.4 + home.offRating - away.defRating + 1.1;
  const a = 22.4 + away.offRating - home.defRating - 1.1;
  return { h, a };
}

function buildSchedule(teams: Team[], week: number): Game[] {
  const r = rng(77);
  const games: Game[] = [];
  for (let w = 1; w <= REG_SEASON_WEEKS; w++) {
    const pool = teams.filter((t) => t.bye !== w).map((t) => t.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const total = pool.length / 2;
    for (let g = 0; g < total; g++) {
      const home = teams.find((t) => t.id === pool[2 * g])!;
      const away = teams.find((t) => t.id === pool[2 * g + 1])!;
      const { kickoff, network } = kickoffFor(w, g, total);
      const game: Game = {
        id: `${SEASON}-w${w}-${away.id}-${home.id}`, season: SEASON, week: w, home: home.id, away: away.id,
        kickoff, network, status: w < week ? 'final' : 'scheduled', weather: weatherFor(home, w, r),
      };
      if (w < week) {
        const { h, a } = expectedPoints(home, away);
        game.homeScore = Math.max(0, Math.round(h + gauss(r, 0, 9.5)));
        game.awayScore = Math.max(0, Math.round(a + gauss(r, 0, 9.5)));
        if (game.homeScore === game.awayScore) game.homeScore += 3;
      }
      games.push(game);
    }
  }
  return games;
}

/* ───────────────────────────── Game logs ───────────────────────────── */

function matchupFactor(rank: number) {
  // rank 1 = toughest → 0.84, rank 32 = softest → 1.16
  return 0.84 + ((rank - 1) / 31) * 0.32;
}

function sampleCount(r: () => number, mu: number, sdFrac = 0.35) {
  return Math.max(0, Math.round(gauss(r, mu, Math.max(0.6, mu * sdFrac))));
}
function sampleTd(r: () => number, mu: number) {
  // Poisson-ish via inversion
  let k = 0;
  let p = Math.exp(-mu);
  let s = p;
  const u = r();
  while (u > s && k < 5) {
    k++;
    p *= mu / k;
    s += p;
  }
  return k;
}

function buildLogs(players: Player[], teams: Team[], games: Game[], week: number): Record<string, GameLog[]> {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const logs: Record<string, GameLog[]> = {};
  for (const pl of players) {
    if (pl.position === 'K' || pl.position === 'DST') {
      const r = rng(hashString(pl.id + 'logs'));
      logs[pl.id] = games
        .filter((g) => g.status === 'final' && (g.home === pl.team || g.away === pl.team))
        .map((g) => {
          const home = g.home === pl.team;
          const opp = home ? g.away : g.home;
          const st = emptyStats();
          const base = pl.position === 'K' ? pl.projection.kPts! : pl.projection.dstPts!;
          const pts = Math.max(pl.position === 'DST' ? -4 : 0, round(gauss(r, base, pl.position === 'K' ? 3.4 : 5.2), 0));
          if (pl.position === 'K') st.kPts = pts;
          else st.dstPts = pts;
          return {
            week: g.week, gameId: g.id, opponent: opp, home, teamScore: (home ? g.homeScore : g.awayScore)!, oppScore: (home ? g.awayScore : g.homeScore)!,
            weather: g.weather, oppRankVsPos: 16, stats: st, snapPct: 1, routes: 0, airYards: 0, redZoneTouches: 0, projectedFactor: 1,
          };
        });
      continue;
    }
    const r = rng(hashString(pl.id + 'logs'));
    const pos = pl.position as 'QB' | 'RB' | 'WR' | 'TE';
    const out: GameLog[] = [];
    // Rookies/injured: some missed games
    const missedFrom = pl.injury.status === 'IR' || pl.injury.status === 'PUP' || pl.injury.status === 'O' ? week - 1 - Math.floor(r() * 3) : 99;
    // Breakout / slump narrative so trends vary
    const drift = gauss(r, 0, 0.06);
    for (const g of games) {
      if (g.status !== 'final' || (g.home !== pl.team && g.away !== pl.team)) continue;
      if (g.week >= missedFrom) continue;
      if (pl.injury.status === 'PUP') continue;
      const home = g.home === pl.team;
      const opp = home ? g.away : g.home;
      const oppTeam = teamById.get(opp)!;
      const rank = oppTeam.defVsPos[pos];
      const mf = matchupFactor(rank) * (home ? 1.02 : 0.98) * (1 + drift * (g.week - week / 2) / 3);
      const weatherHit = g.weather.condition === 'Wind' || g.weather.condition === 'Snow' ? 0.9 : g.weather.condition === 'Rain' ? 0.95 : 1;
      const p = pl.projection;
      const s = emptyStats();
      s.passAtt = sampleCount(r, p.passAtt * (0.95 + 0.1 * r()), 0.15);
      s.passCmp = Math.round(s.passAtt * clamp(p.passAtt ? p.passCmp / p.passAtt + gauss(r, 0, 0.05) : 0, 0, 0.9));
      s.passYds = Math.max(0, Math.round(gauss(r, p.passYds * mf * weatherHit, p.passYds * 0.22)));
      s.passTd = sampleTd(r, p.passTd * mf);
      s.int = sampleTd(r, p.int);
      s.rushAtt = sampleCount(r, p.rushAtt, 0.3);
      s.rushYds = s.rushAtt ? Math.round(gauss(r, s.rushAtt * (p.rushAtt ? p.rushYds / p.rushAtt : 4) * mf, s.rushAtt * 1.6)) : 0;
      s.rushTd = sampleTd(r, p.rushTd * mf);
      s.targets = sampleCount(r, p.targets * (0.96 + 0.08 * mf), 0.33);
      s.rec = Math.min(s.targets, Math.round(s.targets * clamp(p.targets ? p.rec / p.targets + gauss(r, 0, 0.1) : 0, 0, 1)));
      s.recYds = s.rec ? Math.max(0, Math.round(gauss(r, s.rec * (p.rec ? p.recYds / p.rec : 8) * mf * weatherHit, s.rec * 4))) : 0;
      s.recTd = sampleTd(r, p.recTd * mf);
      s.fumLost = r() < p.fumLost ? 1 : 0;
      out.push({
        week: g.week, gameId: g.id, opponent: opp, home, teamScore: (home ? g.homeScore : g.awayScore)!, oppScore: (home ? g.awayScore : g.homeScore)!,
        weather: g.weather, oppRankVsPos: rank, stats: s,
        snapPct: clamp(pl.usage.snapPct + gauss(r, 0, 0.05), 0.05, 1),
        routes: Math.round(pl.usage.routePct * (g.home === pl.team ? 36 : 35) * (0.9 + 0.2 * r())),
        airYards: Math.round(s.targets * pl.usage.aDot * (0.8 + 0.4 * r())),
        redZoneTouches: sampleTd(r, pl.usage.redZoneShare * 5.5),
        projectedFactor: matchupFactor(rank) * (home ? 1.02 : 0.98),
      });
    }
    logs[pl.id] = out;
  }
  return logs;
}

/* ───────────────────────────── Odds & props ───────────────────────────── */

const half = (v: number) => Math.round(v * 2) / 2;

function buildOdds(teams: Team[], games: Game[], week: number, now: number): GameOdds[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const out: GameOdds[] = [];
  const books = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars'];
  for (const g of games.filter((x) => x.week === week || x.week === week + 1)) {
    const r = rng(hashString(g.id + 'odds'));
    const { h, a } = expectedPoints(byId.get(g.home)!, byId.get(g.away)!);
    const openSpread = half(-(h - a) + gauss(r, 0, 1.4));
    const openTotal = half(h + a + gauss(r, 0, 2));
    const steps = 14;
    const hist: LinePoint[] = [];
    let s = openSpread;
    let t = openTotal;
    const start = now - 6 * 86400000;
    for (let i = 0; i <= steps; i++) {
      if (i > 0) {
        if (r() < 0.35) s = half(s + (r() < 0.5 ? -0.5 : 0.5));
        if (r() < 0.3) t = half(t + (r() < 0.5 ? -0.5 : 0.5));
      }
      const p = normCdf(-s / 13.5);
      hist.push({ t: start + (i * (now - start)) / steps, spread: s, total: t, homeMl: americanFromProb(clamp(p, 0.03, 0.97), 0.022) });
    }
    const pHome = normCdf(-s / 13.5);
    out.push({
      gameId: g.id, spread: s, total: t,
      homeMl: americanFromProb(clamp(pHome, 0.03, 0.97), 0.022),
      awayMl: americanFromProb(clamp(1 - pHome, 0.03, 0.97), 0.022),
      open: { spread: openSpread, total: openTotal, homeMl: hist[0].homeMl },
      history: hist, book: books[Math.floor(r() * books.length)],
      publicHomePct: clamp(0.5 + -s * 0.025 + gauss(r, 0, 0.08), 0.18, 0.86),
    });
  }
  return out;
}

function buildProps(players: Player[], teams: Team[], games: Game[], week: number): PlayerProp[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const props: PlayerProp[] = [];
  const weekGames = games.filter((g) => g.week === week);
  for (const pl of players) {
    if (!['QB', 'RB', 'WR', 'TE'].includes(pl.position) || pl.depth !== 1) continue;
    if (['O', 'IR', 'PUP'].includes(pl.injury.status)) continue;
    const g = weekGames.find((x) => x.home === pl.team || x.away === pl.team);
    if (!g) continue;
    const opp = byId.get(g.home === pl.team ? g.away : g.home)!;
    const mf = matchupFactor(opp.defVsPos[pl.position as 'QB']);
    const r = rng(hashString(pl.id + g.id));
    const p = pl.projection;
    const markets: [PropMarket, number][] = [];
    if (pl.position === 'QB') markets.push(['passYds', p.passYds * mf], ['passTd', p.passTd * mf]);
    if (pl.position === 'QB' && p.rushYds > 20) markets.push(['rushYds', p.rushYds]);
    if (pl.position === 'RB') markets.push(['rushYds', p.rushYds * mf]);
    if (pl.position === 'RB' && p.recYds > 18) markets.push(['recYds', p.recYds * mf]);
    if (pl.position === 'WR' || pl.position === 'TE') markets.push(['recYds', p.recYds * mf], ['rec', p.rec * mf]);
    if (pl.position !== 'QB') markets.push(['anytimeTd', (p.rushTd + p.recTd) * mf]);
    for (const [market, mean] of markets) {
      if (mean < 0.15) continue;
      let line: number;
      let overOdds: number;
      let underOdds: number;
      if (market === 'anytimeTd') {
        line = 0.5;
        const pTd = clamp((1 - Math.exp(-mean)) * (1 + gauss(r, 0, 0.12)), 0.08, 0.8);
        overOdds = americanFromProb(pTd, 0.035);
        underOdds = americanFromProb(1 - pTd, 0.035);
      } else if (market === 'passTd') {
        line = mean > 1.85 ? 1.5 : 1.5;
        const pOver = clamp(1 - Math.exp(-mean) * (1 + mean) + gauss(r, 0, 0.05), 0.2, 0.8);
        overOdds = americanFromProb(pOver, 0.025);
        underOdds = americanFromProb(1 - pOver, 0.025);
      } else {
        line = half(mean * (1 + gauss(r, 0, 0.075)));
        const juice = r();
        overOdds = juice < 0.6 ? -110 : juice < 0.8 ? -115 : -105;
        underOdds = overOdds === -110 ? -110 : overOdds === -115 ? -105 : -115;
      }
      props.push({ id: `${pl.id}-${market}-w${week}`, playerId: pl.id, gameId: g.id, market, line, overOdds, underOdds, openLine: market === 'anytimeTd' ? 0.5 : half(line + gauss(r, 0, mean * 0.03)) });
    }
  }
  return props;
}

/* ───────────────────────────── News & trending ───────────────────────────── */

function buildNews(players: Player[], logs: Record<string, GameLog[]>, week: number, now: number): NewsItem[] {
  const r = rng(4242);
  const items: NewsItem[] = [];
  const hoursAgo = (h: number) => now - h * 3600000;
  for (const pl of players) {
    const inj = pl.injury;
    if (inj.status === 'HEALTHY' || !inj.detail) continue;
    const part = inj.detail.split('—')[0].trim().toLowerCase();
    const map: Record<string, [string, string]> = {
      Q: [`${pl.name} listed questionable (${part})`, `${pl.name} was a limited participant this week and carries a questionable tag into Week ${week}. Monitor pregame inactives before lineup lock.`],
      D: [`${pl.name} doubtful for Week ${week}`, `${pl.name} did not practice Wednesday or Thursday (${part}). Plan to pivot; the backup projects for an expanded role.`],
      O: [`${pl.name} ruled out (${part})`, `${pl.name} will not play in Week ${week}.${inj.returnWeek ? ` The team is targeting a Week ${inj.returnWeek} return.` : ''}`],
      IR: [`${pl.name} placed on injured reserve`, `${pl.name} (${part}) moves to IR.${inj.returnWeek ? ` Earliest return projects to Week ${inj.returnWeek}.` : ''} Stash in deeper formats.`],
      PUP: [`${pl.name} remains on PUP list`, `${pl.name} continues to rehab (${part}).${inj.returnWeek ? ` A practice window could open around Week ${inj.returnWeek}.` : ''}`],
    };
    const [headline, body] = map[inj.status] ?? [`${pl.name} injury update`, inj.detail];
    items.push({ id: `inj-${pl.id}`, ts: hoursAgo(2 + r() * 60), playerId: pl.id, team: pl.team, headline, body, type: inj.status === 'Q' ? 'practice' : 'injury', impact: 'negative', source: 'Team report' });
  }
  // Performance notes from last week
  const lastWeek = week - 1;
  const perf = players
    .filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.position))
    .map((p) => ({ p, g: (logs[p.id] || []).find((l) => l.week === lastWeek) }))
    .filter((x) => x.g)
    .map((x) => ({ ...x, score: x.g!.stats.passYds * 0.04 + (x.g!.stats.rushYds + x.g!.stats.recYds) * 0.1 + (x.g!.stats.passTd * 4 + (x.g!.stats.rushTd + x.g!.stats.recTd) * 6) + x.g!.stats.rec * 0.5 }))
    .sort((a, b) => b.score - a.score);
  for (const { p, g } of perf.slice(0, 8)) {
    const s = g!.stats;
    const line = p.position === 'QB'
      ? `${s.passCmp}/${s.passAtt}, ${s.passYds} yds, ${s.passTd} TD${s.rushYds > 15 ? `, ${s.rushYds} rush yds` : ''}`
      : p.position === 'RB'
        ? `${s.rushAtt} carries, ${s.rushYds} yds, ${s.rushTd + s.recTd} TD, ${s.rec} rec`
        : `${s.rec}/${s.targets}, ${s.recYds} yds, ${s.recTd} TD`;
    items.push({ id: `perf-${p.id}`, ts: hoursAgo(24 + r() * 60), playerId: p.id, team: p.team, headline: `${p.name} posts big Week ${lastWeek} line vs ${g!.opponent}`, body: `${p.name} finished with ${line}. ${p.usage.snapPct > 0.75 ? 'Snap share remained elite.' : 'Role continues to grow.'}`, type: 'performance', impact: 'positive', source: 'Box score' });
  }
  // Depth chart / role changes
  const risers = players.filter((p) => p.depth === 2 && ['RB', 'WR', 'TE'].includes(p.position) && p.age < 26).slice(0, 40);
  for (let i = 0; i < 6; i++) {
    const p = risers[Math.floor(r() * risers.length)];
    if (!p || items.some((n) => n.id === `depth-${p.id}`)) continue;
    items.push({ id: `depth-${p.id}`, ts: hoursAgo(r() * 40), playerId: p.id, team: p.team, headline: `${p.name} seeing more first-team reps`, body: `Coaches noted ${p.name.split(' ')[0]}'s expanded role in practice. Snap share has climbed in recent weeks — a speculative add in deeper leagues.`, type: 'depth', impact: 'positive', source: 'Beat reporter' });
  }
  const transactions: [string, string, string][] = [
    ['KC', 'Chiefs sign veteran WR to practice squad', 'Depth move after injuries at receiver. No immediate fantasy impact.'],
    ['DAL', 'Cowboys activate OL from IR', 'Interior line help should boost the run game in the coming weeks.'],
    ['SF', '49ers elevate RB from practice squad', 'Backfield depth with the starter questionable.'],
    ['NYJ', 'Jets claim TE off waivers', 'Blocking-first addition; minimal target impact.'],
  ];
  transactions.forEach(([team, headline, body], i) => items.push({ id: `tx-${i}`, ts: hoursAgo(5 + i * 13 + r() * 6), team, headline, body, type: 'transaction', impact: 'neutral', source: 'Transactions wire' }));
  return items.sort((a, b) => b.ts - a.ts);
}

function buildTrending(players: Player[], logs: Record<string, GameLog[]>): TrendingPlayer[] {
  const r = rng(99);
  const candidates = players.filter((p) => ['QB', 'RB', 'WR', 'TE'].includes(p.position) && (p.depth === 2 || p.talent < 0.62 || p.experience <= 1));
  return candidates
    .map((p) => {
      const recent = (logs[p.id] || []).slice(-2);
      const recentYds = recent.reduce((a, l) => a + l.stats.rushYds + l.stats.recYds + l.stats.passYds * 0.2, 0);
      const heat = recentYds / 60 + (p.experience <= 1 ? 1.2 : 0) + r() * 1.5 + (p.depth === 2 ? 0.4 : 0);
      const rosterPct = clamp(0.06 + p.talent * 0.7 + gauss(r, 0, 0.06), 0.02, 0.92);
      return { playerId: p.id, heat, rosterPct };
    })
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 30)
    .map((x, i) => ({
      playerId: x.playerId,
      adds: Math.round((60000 - i * 1700) * (0.8 + 0.4 * r())),
      drops: Math.round((4000 + r() * 9000)),
      rosterPct: x.rosterPct,
      rosterPctDelta: clamp(0.22 - i * 0.006 + gauss(r, 0, 0.02), 0.01, 0.3),
    }));
}

/* ───────────────────────────── Assemble ───────────────────────────── */

let cached: MockDataset | null = null;

export function getMockDataset(now = Date.now()): MockDataset {
  if (cached) return cached;
  const week = currentWeek(now);
  const teams = buildTeams();
  const players = buildPlayers(teams);
  const games = buildSchedule(teams, week);
  const logs = buildLogs(players, teams, games, week);
  // Weekly anchor keeps odds/news timestamps stable through the session.
  const odds = buildOdds(teams, games, week, now);
  const props = buildProps(players, teams, games, week);
  const news = buildNews(players, logs, week, now);
  const trending = buildTrending(players, logs);
  cached = { season: SEASON, week, teams, players, games, logs, odds, props, news, trending, generatedAt: now };
  return cached;
}

export { matchupFactor };
