import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, CloudSun, Gauge, Grid3x3, Shield, Swords, Zap } from 'lucide-react';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { useOdds } from '@/data/queries';
import type { Game, GameOdds, SkillPosition, Team } from '@/data/types';
import { SKILL_POSITIONS } from '@/data/types';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common/PageHeader';
import { LastUpdated, PageSkeleton } from '@/components/common/states';
import { TeamBadge } from '@/components/common/badges';
import { PlayerCell } from '@/components/common/PlayerCell';
import { impliedTotals, kickoffLabel } from '@/lib/stats';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { rankHeat } from '@/lib/heat';

export default function MatchupsPage() {
  const { data: u, isLoading } = useUniverse();
  const [week, setWeek] = useState<number | null>(null);
  const w = week ?? u?.core.week ?? 1;
  const odds = useOdds(w);
  const games = useMemo(() => (u ? u.core.games.filter((g) => g.week === w).sort((a, b) => a.kickoff.localeCompare(b.kickoff)) : []), [u, w]);
  const [gameId, setGameId] = useState<string | null>(null);
  if (isLoading || !u) return <PageSkeleton />;
  const game = games.find((g) => g.id === gameId) ?? games[0];
  const weeks = [u.core.week, u.core.week + 1, u.core.week + 2].filter((x) => x <= 18);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Matchup Analyzer"
        subtitle="Defense vs position, pace, trench battles and implied team totals"
        actions={
          <>
            <Segmented<string> value={String(w)} onChange={(v) => { setWeek(Number(v)); setGameId(null); }} options={weeks.map((x) => ({ value: String(x), label: `Week ${x}` }))} layoutId="mu-week" aria-label="Week" />
            <LastUpdated at={odds.dataUpdatedAt || undefined} />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader icon={<Swords />} title={`Week ${w} games`} subtitle={`${games.length} games`} />
          <div className="scrollbar-thin max-h-[640px] overflow-y-auto">
            {games.map((g) => {
              const o = odds.data?.data.find((x) => x.gameId === g.id);
              const it = o ? impliedTotals(o.spread, o.total) : null;
              return (
                <button key={g.id} onClick={() => setGameId(g.id)} className={cn('flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-surface-2/60', game?.id === g.id && 'bg-accent/[0.07] shadow-[inset_3px_0_0_hsl(var(--accent))]')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm"><TeamBadge team={u.teams.get(g.away)} /> <span className="text-fg-subtle">@</span> <TeamBadge team={u.teams.get(g.home)} /></div>
                    <div className="text-2xs text-fg-subtle">{kickoffLabel(g.kickoff)}</div>
                  </div>
                  <div className="num text-right text-xs">
                    {o ? <><div className="font-semibold">{g.home} {fmt.spread(o.spread)}</div><div className="text-fg-subtle">{it!.away.toFixed(1)}–{it!.home.toFixed(1)}</div></> : <span className="text-fg-subtle">Lines soon</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
        {game && <GameDetail u={u} game={game} odds={odds.data?.data.find((x) => x.gameId === game.id)} />}
      </div>
      <DefenseHeatmap u={u} highlight={game ? [game.home, game.away] : []} />
    </div>
  );
}

function GameDetail({ u, game, odds }: { u: UniverseState; game: Game; odds?: GameOdds }) {
  const home = u.teams.get(game.home)!;
  const away = u.teams.get(game.away)!;
  const it = odds ? impliedTotals(odds.spread, odds.total) : null;
  const sides: { team: Team; opp: Team; implied: number | null }[] = [
    { team: away, opp: home, implied: it?.away ?? null },
    { team: home, opp: away, implied: it?.home ?? null },
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="relative grid grid-cols-2">
          {sides.map(({ team, implied }, i) => (
            <div key={team.id} className={cn('relative p-5', i === 1 && 'text-right')}>
              <div className="absolute inset-0 opacity-[0.16]" style={{ background: `linear-gradient(${i === 0 ? '110deg' : '250deg'}, ${team.colors.primary}, transparent 70%)` }} aria-hidden />
              <div className="relative">
                <div className="text-2xs uppercase tracking-[0.08em] text-fg-subtle">{i === 0 ? 'Away' : 'Home'}</div>
                <div className="text-xl font-semibold">{team.city} {team.name}</div>
                <div className="num mt-2 text-3xl font-semibold tracking-tight">{implied ? implied.toFixed(1) : '—'}</div>
                <div className="text-xs text-fg-subtle">implied points</div>
              </div>
            </div>
          ))}
          <div className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-surface-1 text-xs font-bold text-fg-subtle">VS</div>
        </div>
        <div className="num grid grid-cols-2 border-t border-border text-center text-xs sm:grid-cols-4">
          <div className="p-3"><div className="text-fg-subtle">Spread</div><div className="font-semibold">{odds ? `${game.home} ${fmt.spread(odds.spread)}` : '—'}</div></div>
          <div className="p-3"><div className="text-fg-subtle">Total</div><div className="font-semibold">{odds?.total ?? '—'}</div></div>
          <div className="p-3"><div className="text-fg-subtle">Kickoff</div><div className="font-semibold">{kickoffLabel(game.kickoff)}</div></div>
          <div className="p-3"><div className="text-fg-subtle"><CloudSun className="mr-1 inline size-3" />Weather</div><div className="font-semibold">{game.weather.condition === 'Dome' ? 'Dome' : `${game.weather.condition} ${game.weather.tempF}° · ${game.weather.windMph} mph`}</div></div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Shield />} title="Trench battle" subtitle="Offensive line pass protection vs opposing pass rush (rank, 1 = best)" />
          <CardBody className="space-y-4">
            {sides.map(({ team, opp }) => {
              const edge = opp.passRushRank - team.oLinePassBlockRank;
              return (
                <div key={team.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold">{team.id} OL vs {opp.id} pass rush</span><span className={cn('font-semibold', Math.abs(edge) > 4 ? 'text-accent' : 'text-fg-subtle')}>{edge > 4 ? `${team.id} edge` : edge < -4 ? `${opp.id} edge` : 'Even'}</span></div>
                  <RankBar label={`${team.id} pass block`} rank={team.oLinePassBlockRank} />
                  <RankBar label={`${opp.id} pass rush`} rank={opp.passRushRank} />
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Gauge />} title="Pace & tendencies" subtitle="Plays per game and pass rate" />
          <CardBody className="space-y-3">
            {sides.map(({ team }) => (
              <div key={team.id} className="grid grid-cols-[48px_1fr_64px] items-center gap-3 text-xs">
                <TeamBadge team={team} />
                <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${((team.pace - 58) / 10) * 100}%` }} /></div>
                <span className="num text-right font-semibold">{team.pace.toFixed(1)} pl</span>
              </div>
            ))}
            {sides.map(({ team }) => (
              <div key={team.id + 'p'} className="grid grid-cols-[48px_1fr_64px] items-center gap-3 text-xs">
                <TeamBadge team={team} />
                <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-fg-subtle" style={{ width: `${team.passRate * 100}%` }} /></div>
                <span className="num text-right font-semibold">{fmt.pct(team.passRate)} pass</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-fg-subtle">Combined pace {((home.pace + away.pace) / 2).toFixed(1)} plays — {(home.pace + away.pace) / 2 > 64 ? 'above' : 'below'} league average (63.5).</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Zap />} title="Fantasy matchups" subtitle="Each offense's starters vs the opposing defense's rank at their position (32 = softest)" />
        <div className="grid divide-border md:grid-cols-2 md:divide-x">
          {sides.map(({ team, opp }) => {
            const starters = u.core.players.filter((p) => p.team === team.id && p.depth === 1 && SKILL_POSITIONS.includes(p.position as SkillPosition)).map((p) => ({ p, v: u.universe.byId.get(p.id)! })).sort((a, b) => b.v.week.mean - a.v.week.mean).slice(0, 6);
            return (
              <div key={team.id} className="divide-y divide-border/70">
                {starters.map(({ p, v }) => {
                  const r = opp.defVsPos[p.position as SkillPosition];
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                      <PlayerCell player={p} team={team} posRank={v.posRank} className="flex-1" size="xs" />
                      <Tooltip content={`${opp.id} ranks ${r}/32 vs ${p.position}`}><span className={cn('num grid h-6 w-9 place-items-center rounded text-xs font-semibold', rankHeat(r))}>{r}</span></Tooltip>
                      <span className="num w-10 text-right text-sm font-semibold">{fmt.num(v.week.mean)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function RankBar({ label, rank }: { label: string; rank: number }) {
  const strength = (33 - rank) / 32;
  return (
    <div className="mb-1 grid grid-cols-[110px_1fr_32px] items-center gap-2 text-2xs">
      <span className="text-fg-subtle">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${strength * 100}%` }} /></div>
      <span className="num text-right font-semibold">#{rank}</span>
    </div>
  );
}

type SortKey = SkillPosition | 'team' | 'pace' | 'passRush';

function DefenseHeatmap({ u, highlight }: { u: UniverseState; highlight: string[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'WR', desc: true });
  const teams = useMemo(() => {
    const val = (t: Team) => (sort.key === 'team' ? t.id : sort.key === 'pace' ? t.pace : sort.key === 'passRush' ? t.passRushRank : t.defVsPos[sort.key]);
    return [...u.teams.values()].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [u, sort]);
  const Head = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-2 py-2 text-center">
      <button onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true }))} className={cn('inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.06em] hover:text-fg', sort.key === k ? 'text-fg' : 'text-fg-subtle')}>
        {children}{sort.key === k && (sort.desc ? <ArrowDown className="size-3 text-accent" /> : <ArrowUp className="size-3 text-accent" />)}
      </button>
    </th>
  );
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Grid3x3 />} title="Defense vs position heat map" subtitle="Fantasy points allowed rank — green = soft matchup, red = tough" actions={<div className="hidden items-center gap-2 text-2xs text-fg-subtle sm:flex"><span className="size-3 rounded bg-neg/30" /> Tough <span className="size-3 rounded bg-surface-3" /> <span className="size-3 rounded bg-pos/30" /> Soft</div>} />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-surface-2/60"><tr><Head k="team">Defense</Head>{SKILL_POSITIONS.map((p) => <Head key={p} k={p}>vs {p}</Head>)}<Head k="passRush">Pass rush</Head><Head k="pace">Pace</Head></tr></thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className={cn('border-t border-border/60', highlight.includes(t.id) && 'bg-accent/[0.06]')}>
                <td className="px-3 py-1.5"><Link to={`/players?pos=DST`} className="hover:underline"><TeamBadge team={t} showName /></Link></td>
                {SKILL_POSITIONS.map((p) => (
                  <td key={p} className="px-1.5 py-1"><div className={cn('num mx-auto grid h-7 max-w-[88px] place-items-center rounded text-xs font-semibold', rankHeat(t.defVsPos[p]))}>{t.defVsPos[p]}</div></td>
                ))}
                <td className="num px-2 text-center text-xs text-fg-muted">#{t.passRushRank}</td>
                <td className="num px-2 text-center text-xs text-fg-muted">{t.pace.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
