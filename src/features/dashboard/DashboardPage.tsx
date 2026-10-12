import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Flame, LineChart, Star, Target, TrendingUp, Trophy } from 'lucide-react';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { useMyLineup } from '@/hooks/useLineup';
import { useAllLogs, useNews, useOdds } from '@/data/queries';
import { useLeagues } from '@/store/leagues';
import { useWatchlist } from '@/store/watchlist';
import { useBets } from '@/store/bets';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common/PageHeader';
import { CardSkeleton, EmptyState, LastUpdated, PageSkeleton } from '@/components/common/states';
import { ConfidenceMeter, KpiTile, TrendArrow } from '@/components/common/metrics';
import { PlayerCell } from '@/components/common/PlayerCell';
import { TeamBadge } from '@/components/common/badges';
import { Sparkline } from '@/components/charts/Sparkline';
import { ModeChips } from '@/components/layout/LeagueSwitcher';
import { analyzeGame } from '@/engine/betting/model';
import { trackerStats } from '@/engine/betting/tracker';
import { fmt, ordinal, timeAgo, lastName } from '@/lib/format';
import { impliedTotals, kickoffLabel, recentTrend } from '@/lib/stats';
import { leagueFormat, STRATEGY_LABEL } from '@/lib/league';
import { cn } from '@/lib/utils';
import type { GameOdds } from '@/data/types';

export default function DashboardPage() {
  const { data: u, isLoading } = useUniverse();
  const lineup = useMyLineup(u);
  const odds = useOdds(u?.core.week);
  const news = useNews(u?.core);
  const bets = useBets((s) => s.bets);
  const betStats = useMemo(() => trackerStats(bets), [bets]);

  if (isLoading || !u || !lineup) return <PageSkeleton />;
  const myTeam = u.league.rosters.find((t) => t.id === u.league.myTeamId);
  const injuredMine = u.myRoster.map((id) => u.players.get(id)!).filter((p) => p && p.injury.status !== 'HEALTHY');
  const teamValues = u.league.rosters
    .map((t) => ({ id: t.id, v: t.playerIds.reduce((a, id) => a + (u.universe.byId.get(id)?.value ?? 0), 0) }))
    .sort((a, b) => b.v - a.v);
  const myRank = teamValues.findIndex((t) => t.id === u.league.myTeamId) + 1;
  const myValue = teamValues.find((t) => t.id === u.league.myTeamId)?.v ?? 0;
  const lowConf = lineup.rows.filter((r) => r.entry && r.confidence < 65).length;
  const bestEdge = odds.data?.data
    .map((o) => {
      const g = u.core.games.find((x) => x.id === o.gameId);
      return g ? analyzeGame(g, o, u.teams.get(g.home)!, u.teams.get(g.away)!, u.core.players).best : null;
    })
    .filter(Boolean)
    .sort((a, b) => b!.edge - a!.edge)[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><CalendarDays className="size-3.5" /> Week {u.core.week} · {u.core.season} regular season</>}
        title={`Good ${greeting()}, ${myTeam?.name ?? 'coach'}`}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{u.league.name} <ModeChips mode={u.league.mode} superflex={u.league.superflex} /> <span className="text-fg-subtle">{leagueFormat(u.league)} · {STRATEGY_LABEL[u.league.strategy]}</span></span>}
        actions={<LastUpdated at={u.fetchedAt} source={u.source} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Projected lineup" icon={<ClipboardList />} value={`${fmt.num(lineup.total)} pts`} sub={`Range ${fmt.num(lineup.floor, 0)}–${fmt.num(lineup.ceiling, 0)} · ${myTeam?.record ? `${myTeam.record.w}–${myTeam.record.l}` : '—'}`} delta={lowConf ? <Badge tone="warn">{lowConf} close call{lowConf > 1 ? 's' : ''}</Badge> : <Badge tone="pos">Set</Badge>} />
        <KpiTile label="Roster value" icon={<Trophy />} value={fmt.value(myValue)} sub={`Ranks ${myRank} of ${u.league.rosters.length} by ${u.league.mode} value`} delta={<Badge tone={myRank <= 3 ? 'pos' : myRank > u.league.rosters.length - 3 ? 'neg' : 'neutral'}>#{myRank}</Badge>} />
        <KpiTile label="Injury alerts" icon={<AlertTriangle />} value={injuredMine.length} sub={injuredMine.length ? injuredMine.slice(0, 2).map((p) => lastName(p.name)).join(', ') + (injuredMine.length > 2 ? ` +${injuredMine.length - 2}` : '') : 'Roster is healthy'} delta={injuredMine.length ? <Badge tone="neg">Action</Badge> : undefined} />
        <KpiTile label="Betting P/L" icon={<LineChart />} value={<span className={betStats.profit >= 0 ? 'text-pos' : 'text-neg'}>{fmt.units(betStats.profit)}</span>} sub={`ROI ${fmt.signedPct(betStats.roi)} · ${bestEdge ? `Top edge ${bestEdge.label} ${fmt.signedPct(bestEdge.edge)}` : `${betStats.wins}–${betStats.losses}`}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <SlateCard u={u} odds={odds.data?.data} loading={odds.isLoading} updatedAt={odds.dataUpdatedAt} className="xl:col-span-8" />
        <LineupCard u={u} lineup={lineup} className="xl:col-span-4" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <TopPlaysCard u={u} />
        <InjuryCard u={u} newsTs={news.data?.data} />
        <LineMovementCard u={u} odds={odds.data?.data} loading={odds.isLoading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LeaguesCard u={u} />
        <WatchlistCard u={u} />
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/* ───────────────────────── Slate ───────────────────────── */

function SlateCard({ u, odds, loading, updatedAt, className }: { u: UniverseState; odds?: GameOdds[]; loading: boolean; updatedAt: number; className?: string }) {
  const games = u.core.games.filter((g) => g.week === u.core.week).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const myTeams = new Set(u.myRoster.map((id) => u.players.get(id)?.team));
  return (
    <Card className={className}>
      <CardHeader icon={<CalendarDays />} title={`Week ${u.core.week} slate`} subtitle={`${games.length} games · spreads, totals and implied team totals`} actions={<LastUpdated at={updatedAt || undefined} />} />
      {loading ? (
        <CardSkeleton rows={6} />
      ) : (
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
              <tr className="text-2xs uppercase tracking-[0.06em] text-fg-subtle">
                <th className="px-4 py-2 text-left font-semibold">Matchup</th>
                <th className="hidden px-2 py-2 text-left font-semibold sm:table-cell">Kickoff</th>
                <th className="px-2 py-2 text-right font-semibold">Spread</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="hidden px-4 py-2 text-right font-semibold md:table-cell">Implied</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const o = odds?.find((x) => x.gameId === g.id);
                const it = o ? impliedTotals(o.spread, o.total) : null;
                const mine = myTeams.has(g.home) || myTeams.has(g.away);
                return (
                  <tr key={g.id} className="border-t border-border/70 transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <TeamBadge team={u.teams.get(g.away)} />
                        <span className="text-fg-subtle">@</span>
                        <TeamBadge team={u.teams.get(g.home)} />
                        {mine && <Tooltip content="You have players in this game"><Star className="size-3 fill-accent text-accent" /></Tooltip>}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2.5 text-xs text-fg-subtle sm:table-cell">{kickoffLabel(g.kickoff)} · {g.network}</td>
                    <td className="num whitespace-nowrap px-2 py-2.5 text-right">{o ? <span>{g.home} {fmt.spread(o.spread)}</span> : '—'}</td>
                    <td className="num px-4 py-2.5 text-right sm:px-2">{o ? o.total.toFixed(1) : '—'}</td>
                    <td className="num hidden px-4 py-2.5 text-right text-xs text-fg-muted md:table-cell">{it ? `${g.away} ${it.away.toFixed(1)} · ${g.home} ${it.home.toFixed(1)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Lineup ───────────────────────── */

function LineupCard({ u, lineup, className }: { u: UniverseState; lineup: NonNullable<ReturnType<typeof useMyLineup>>; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader icon={<ClipboardList />} title="My lineup" subtitle={`Optimal for Week ${u.core.week}`} actions={<Button asChild size="xs" variant="ghost"><Link to="/lineup">Optimize <ArrowRight /></Link></Button>} />
      <div className="flex-1 divide-y divide-border/70">
        {lineup.rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2">
            <span className="w-9 text-2xs font-bold uppercase text-fg-subtle">{r.slot === 'SUPERFLEX' ? 'SF' : r.slot}</span>
            {r.entry ? (
              <>
                <PlayerCell player={r.entry.player} team={u.teams.get(r.entry.player.team)} size="xs" className="flex-1" sub={r.entry.val.week.opp ? `${r.entry.val.week.home ? 'vs' : '@'} ${r.entry.val.week.opp}` : 'BYE'} />
                <ConfidenceMeter value={r.confidence} compact />
                <span className="num w-10 text-right text-sm font-semibold">{fmt.num(r.entry.mean)}</span>
              </>
            ) : (
              <span className="text-xs text-fg-subtle">Empty slot</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
        <span className="text-fg-subtle">Projected total</span>
        <span className="num text-md font-semibold">{fmt.num(lineup.total)}</span>
      </div>
    </Card>
  );
}

/* ───────────────────────── Top plays ───────────────────────── */

function TopPlaysCard({ u }: { u: UniverseState }) {
  const nav = useNavigate();
  const plays = useMemo(() => {
    return u.universe.ranked
      .filter((v) => ['QB', 'RB', 'WR', 'TE'].includes(v.position) && !v.week.bye && v.week.mean > 8 && (v.week.matchupRank ?? 0) >= 22)
      .map((v) => ({ v, p: u.players.get(v.playerId)!, boost: v.week.mean - v.ppg }))
      .sort((a, b) => b.boost - a.boost)
      .slice(0, 7);
  }, [u]);
  return (
    <Card>
      <CardHeader icon={<Flame />} title="Top plays" subtitle="Biggest matchup boosts vs season baseline" />
      <div className="divide-y divide-border/70">
        {plays.map(({ v, p, boost }) => (
          <button key={p.id} onClick={() => nav(`/players/${p.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60">
            <PlayerCell player={p} team={u.teams.get(p.team)} posRank={v.posRank} link={false} className="flex-1" sub={`${v.week.home ? 'vs' : '@'} ${v.week.opp} · ${ordinalRank(v.week.matchupRank)} vs ${p.position}`} />
            <div className="text-right">
              <div className="num text-sm font-semibold">{fmt.num(v.week.mean)}</div>
              <TrendArrow value={boost} />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
const ordinalRank = (r: number | null) => (r ? `${ordinal(33 - r)} easiest` : '');

/* ───────────────────────── Injuries ───────────────────────── */

function InjuryCard({ u, newsTs }: { u: UniverseState; newsTs?: { playerId?: string; ts: number }[] }) {
  const mine = new Set(u.myRoster);
  const list = u.core.players
    .filter((p) => p.injury.status !== 'HEALTHY' && (mine.has(p.id) || (u.universe.byId.get(p.id)?.overallRank ?? 999) < 120))
    .map((p) => ({ p, mine: mine.has(p.id), v: u.universe.byId.get(p.id)!, ts: newsTs?.find((n) => n.playerId === p.id)?.ts }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.v.overallRank - b.v.overallRank)
    .slice(0, 7);
  return (
    <Card>
      <CardHeader icon={<AlertTriangle />} title="Injury alerts" subtitle="Your roster first, then fantasy-relevant" actions={<Button asChild size="xs" variant="ghost"><Link to="/news?filter=injury">All <ArrowRight /></Link></Button>} />
      {list.length === 0 ? (
        <EmptyState icon={<Activity />} title="No notable injuries" />
      ) : (
        <div className="divide-y divide-border/70">
          {list.map(({ p, mine, v, ts }) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <PlayerCell player={p} team={u.teams.get(p.team)} posRank={v.posRank} className="flex-1" sub={p.injury.detail?.split('—')[0]} />
              <div className="text-right">
                {mine && <Badge tone="accent" className="mb-0.5">My team</Badge>}
                <div className="text-2xs text-fg-subtle">{ts ? timeAgo(ts) : p.injury.returnWeek ? `Target Wk ${p.injury.returnWeek}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Line movement ───────────────────────── */

function LineMovementCard({ u, odds, loading }: { u: UniverseState; odds?: GameOdds[]; loading: boolean }) {
  const moves = (odds ?? [])
    .map((o) => ({ o, g: u.core.games.find((g) => g.id === o.gameId)!, move: o.spread - o.open.spread, tMove: o.total - o.open.total }))
    .filter((x) => x.g && x.g.week === u.core.week)
    .sort((a, b) => Math.abs(b.move) + Math.abs(b.tMove) * 0.5 - (Math.abs(a.move) + Math.abs(a.tMove) * 0.5))
    .slice(0, 6);
  return (
    <Card>
      <CardHeader icon={<TrendingUp />} title="Line movement" subtitle="Largest moves since open" actions={<Button asChild size="xs" variant="ghost"><Link to="/betting">Hub <ArrowRight /></Link></Button>} />
      {loading ? (
        <CardSkeleton rows={5} />
      ) : (
        <div className="divide-y divide-border/70">
          {moves.map(({ o, g, move, tMove }) => (
            <div key={o.gameId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-28 shrink-0">
                <div className="text-sm font-medium">{g.away} @ {g.home}</div>
                <div className="num text-2xs text-fg-subtle">{g.home} {fmt.spread(o.open.spread)} → {fmt.spread(o.spread)}</div>
              </div>
              <div className="h-8 min-w-0 flex-1"><Sparkline data={o.history.map((h) => -h.spread)} tone={move === 0 ? 'neutral' : 'accent'} height={32} /></div>
              <div className="w-16 text-right">
                <div className={cn('num text-sm font-semibold', move === 0 ? 'text-fg-subtle' : 'text-fg')}>{move === 0 ? '—' : fmt.signed(move)}</div>
                <div className="num text-2xs text-fg-subtle">O/U {tMove === 0 ? '—' : fmt.signed(tMove)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Leagues ───────────────────────── */

function LeaguesCard({ u }: { u: UniverseState }) {
  const leagues = useLeagues((s) => s.leagues);
  const setActive = useLeagues((s) => s.setActive);
  return (
    <Card>
      <CardHeader icon={<Trophy />} title="My leagues" subtitle="Switch context — every number re-prices" actions={<Button asChild size="xs" variant="ghost"><Link to="/leagues">Manage <ArrowRight /></Link></Button>} />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {leagues.map((l) => {
          const team = l.rosters.find((t) => t.id === l.myTeamId);
          const active = l.id === u.league.id;
          return (
            <button
              key={l.id}
              onClick={() => setActive(l.id)}
              className={cn('rounded-lg border p-3 text-left transition-all hover:border-border-strong', active ? 'border-accent/60 bg-accent/[0.06] shadow-glow' : 'border-border bg-surface-2/50')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{l.name}</div>
                  <div className="truncate text-2xs text-fg-subtle">{leagueFormat(l)}</div>
                </div>
                <ModeChips mode={l.mode} superflex={l.superflex} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="truncate text-fg-muted">{team?.name}</span>
                <span className="num font-semibold">{team?.record ? `${team.record.w}–${team.record.l}` : '—'}</span>
              </div>
              {active && <div className="mt-2 text-2xs font-semibold text-accent">Active league</div>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────────────────── Watchlist ───────────────────────── */

function WatchlistCard({ u }: { u: UniverseState }) {
  const ids = useWatchlist((s) => s.ids);
  const logs = useAllLogs();
  const nav = useNavigate();
  return (
    <Card>
      <CardHeader icon={<Star />} title="Saved players" subtitle="Your watchlist with recent form" />
      {ids.length === 0 ? (
        <EmptyState icon={<Target />} title="No saved players" description="Star a player from their profile to track them here." />
      ) : (
        <div className="divide-y divide-border/70">
          {ids.slice(0, 8).map((id) => {
            const p = u.players.get(id);
            const v = u.universe.byId.get(id);
            if (!p || !v) return null;
            const tr = logs.data ? recentTrend(logs.data[id] ?? [], p.position, u.league.scoring) : null;
            return (
              <button key={id} onClick={() => nav(`/players/${id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60">
                <PlayerCell player={p} team={u.teams.get(p.team)} posRank={v.posRank} link={false} className="min-w-0 flex-1" />
                <div className="hidden h-8 w-24 sm:block">{tr && <Sparkline data={tr.series} tone={tr.delta >= 0 ? 'pos' : 'neg'} />}</div>
                <div className="w-20 text-right">
                  <div className="num text-sm font-semibold">{fmt.value(v.value)}</div>
                  {tr && <TrendArrow value={tr.delta} suffix=" ppg" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
