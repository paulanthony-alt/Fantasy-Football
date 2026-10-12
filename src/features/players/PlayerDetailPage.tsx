import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, CalendarRange, Gauge, LineChart as LineIcon, Scale, Star, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { useGameLogs } from '@/data/queries';
import { useWatchlist } from '@/store/watchlist';
import { useTrades } from '@/store/trades';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { PlayerAvatar } from '@/components/common/PlayerAvatar';
import { AgeIndicator, InjuryBadge, PositionBadge, TeamBadge } from '@/components/common/badges';
import { AnimatedNumber, StatPill, ValueBar } from '@/components/common/metrics';
import { EmptyState, LastUpdated, PageSkeleton } from '@/components/common/states';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { totals } from '@/lib/stats';
import { OverviewTab } from './detail/OverviewTab';
import { GameLogTab } from './detail/GameLogTab';
import { SplitsTab } from './detail/SplitsTab';
import { OutlookTab } from './detail/OutlookTab';
import type { Player } from '@/data/types';
import type { PlayerValuation } from '@/engine/valuation';

export default function PlayerDetailPage() {
  const { id } = useParams();
  const { data: u, isLoading } = useUniverse();
  const logsQ = useGameLogs(id, u?.core);
  const nav = useNavigate();
  const watch = useWatchlist();
  const setDraft = useTrades((s) => s.setDraft);
  const drafts = useTrades((s) => s.drafts);

  const p = u && id ? u.players.get(id) : undefined;
  const v = u && id ? u.universe.byId.get(id) : undefined;
  const logs = useMemo(() => logsQ.data?.data ?? [], [logsQ.data]);

  if (isLoading || !u) return <PageSkeleton />;
  if (!p || !v) {
    return <EmptyState className="py-24" icon={<UserX />} title="Player not found" description="They may not be in the current data snapshot." action={<Button asChild variant="primary"><Link to="/players">Browse players</Link></Button>} />;
  }
  const team = u.teams.get(p.team);
  const starred = watch.ids.includes(p.id);
  const owner = u.rosteredBy.get(p.id);
  const ownerName = owner ? (owner === u.league.myTeamId ? 'Your team' : u.league.rosters.find((t) => t.id === owner)?.name) : 'Free agent';

  const addToTrade = () => {
    const d = drafts[u.league.id] ?? { teamIds: [u.league.myTeamId, u.league.rosters.find((t) => t.id !== u.league.myTeamId)!.id], assets: [] };
    if (d.assets.some((a) => a.ref.kind === 'player' && a.ref.playerId === p.id)) {
      nav('/trade');
      return;
    }
    const mine = owner === u.league.myTeamId;
    const partner = mine ? d.teamIds.find((t) => t !== u.league.myTeamId)! : owner ?? d.teamIds.find((t) => t !== u.league.myTeamId)!;
    const teamIds = d.teamIds.includes(partner) ? d.teamIds : [u.league.myTeamId, partner];
    setDraft(u.league.id, { teamIds, assets: [...(teamIds === d.teamIds ? d.assets : []), { key: `${p.id}-${Date.now()}`, ref: { kind: 'player', playerId: p.id }, from: mine ? u.league.myTeamId : partner, to: mine ? partner : u.league.myTeamId }] });
    toast.success(`${p.name} added to trade desk`, { action: { label: 'Open', onClick: () => nav('/trade') } });
  };

  const t = totals(logs);
  const usage = playerUsageSummary(p, v, t);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => (window.history.length > 2 ? nav(-1) : nav('/players'))}><ArrowLeft /> Back</Button>
        <LastUpdated at={logsQ.data?.fetchedAt} source={logsQ.data?.source} />
      </div>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 opacity-[0.22]" style={{ background: `linear-gradient(115deg, ${team?.colors.primary ?? '#334155'} 0%, transparent 62%)` }} aria-hidden />
          <div className="bg-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(to_right,black,transparent_70%)]" aria-hidden />
          <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <PlayerAvatar player={p} team={team} size="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
                  <InjuryBadge status={p.injury.status} detail={p.injury.detail} returnWeek={p.injury.returnWeek} verbose />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-fg-muted">
                  <PositionBadge pos={p.position} rank={v.posRank} />
                  <TeamBadge team={team} showName />
                  {p.position !== 'DST' && <AgeIndicator age={p.age} pos={p.position} showLabel />}
                  {p.position !== 'DST' && <span className="text-xs">Year {p.experience}</span>}
                  {p.draft && <span className="text-xs">Drafted {p.draft.year} R{p.draft.round}</span>}
                  {p.position !== 'DST' && p.position !== 'K' && <span className="text-xs">{p.contractYearsLeft} yr{p.contractYearsLeft === 1 ? '' : 's'} of control</span>}
                </div>
                <div className="mt-2 text-xs text-fg-subtle">Rostered by <span className={cn('font-semibold', owner === u.league.myTeamId ? 'text-accent' : !owner ? 'text-pos' : 'text-fg-muted')}>{ownerName}</span> in {u.league.name}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Tooltip content={starred ? 'Remove from watchlist' : 'Save to watchlist'}>
                <Button variant={starred ? 'primary' : 'secondary'} size="icon" onClick={() => { watch.toggle(p.id); toast(starred ? 'Removed from watchlist' : 'Saved to watchlist'); }} aria-pressed={starred} aria-label="Toggle watchlist">
                  <Star className={starred ? 'fill-current' : ''} />
                </Button>
              </Tooltip>
              <Button variant="secondary" asChild><Link to={`/lineup?compare=${p.id}`}><Scale /> Compare</Link></Button>
              <Button variant="primary" onClick={addToTrade}><ArrowLeftRight /> Add to trade</Button>
            </div>
          </div>
        </div>
        {/* Values side by side */}
        <div className="grid border-t border-border sm:grid-cols-3">
          <ValueTile label="Redraft value" value={v.redraftValue} rank={rankOf(u, v, 'redraftValue')} pos={p.position} active={u.league.mode === 'redraft'} hint={`ROS ${fmt.num(v.ros.points, 0)} pts · ${fmt.num(v.ros.games, 1)} games`} />
          <ValueTile label="Dynasty value" value={v.dynastyValue} rank={rankOf(u, v, 'dynastyValue')} pos={p.position} active={u.league.mode === 'dynasty'} hint={`5-yr ${fmt.num(v.dynasty.seasonPoints.reduce((a, b) => a + b, 0), 0)} pts · ${v.agePhase}`} />
          <ValueTile label="Keeper value" value={v.keeperValue} rank={rankOf(u, v, 'keeperValue')} pos={p.position} active={u.league.mode === 'keeper'} hint="This season + next" />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <StatPill label="Proj PPG" value={fmt.num(v.ppg)} />
        <StatPill label={`Wk ${u.core.week}`} value={v.week.bye ? 'BYE' : `${fmt.num(v.week.mean)} (${fmt.num(v.week.floor, 0)}–${fmt.num(v.week.ceiling, 0)})`} tone="accent" />
        {usage.map((s) => <StatPill key={s.label} label={s.label} value={s.value} title={s.title} />)}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><LineIcon /> Overview</TabsTrigger>
          <TabsTrigger value="log"><CalendarRange /> Game log</TabsTrigger>
          <TabsTrigger value="splits"><Gauge /> Splits</TabsTrigger>
          <TabsTrigger value="outlook"><Scale /> Outlook</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4"><OverviewTab u={u} p={p} v={v} logs={logs} loading={logsQ.isLoading} /></TabsContent>
        <TabsContent value="log" className="pt-4"><GameLogTab u={u} p={p} logs={logs} loading={logsQ.isLoading} /></TabsContent>
        <TabsContent value="splits" className="pt-4"><SplitsTab u={u} p={p} logs={logs} /></TabsContent>
        <TabsContent value="outlook" className="pt-4"><OutlookTab u={u} p={p} v={v} /></TabsContent>
      </Tabs>
    </div>
  );
}

function rankOf(u: UniverseState, v: PlayerValuation, key: 'redraftValue' | 'dynastyValue' | 'keeperValue') {
  let r = 1;
  u.universe.byId.forEach((o) => {
    if (o.position === v.position && o[key] > v[key]) r++;
  });
  return r;
}

function ValueTile({ label, value, rank, pos, active, hint }: { label: string; value: number; rank: number; pos: string; active: boolean; hint: string }) {
  return (
    <div className={cn('relative border-border p-4 sm:border-l first:sm:border-l-0', active && 'bg-accent/[0.05]')}>
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" aria-hidden />}
      <div className="flex items-center gap-2">
        <span className="label-caps">{label}</span>
        {active && <Badge tone="accent">Active mode</Badge>}
        <span className="num ml-auto text-xs text-fg-subtle">{pos}{rank}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <AnimatedNumber value={value} className="text-2xl font-semibold tracking-tight" />
        <span className="text-xs text-fg-subtle">/ 10,000</span>
      </div>
      <ValueBar value={value} className="mt-2" tone={active ? 'accent' : 'neutral'} />
      <div className="mt-2 text-xs text-fg-subtle">{hint}</div>
    </div>
  );
}

function playerUsageSummary(p: Player, v: PlayerValuation, t: ReturnType<typeof totals>) {
  void v;
  if (p.position === 'K' || p.position === 'DST') return [];
  const out: { label: string; value: string; title?: string }[] = [{ label: 'Snap %', value: fmt.pct(t.games ? t.snaps / t.games : p.usage.snapPct) }];
  if (p.position === 'QB') {
    out.push({ label: 'Cmp %', value: t.passAtt ? fmt.pct(t.passCmp / t.passAtt, 1) : '—' }, { label: 'Y/A', value: t.passAtt ? fmt.num(t.passYds / t.passAtt) : '—' }, { label: 'Rush yds/g', value: t.games ? fmt.num(t.rushYds / t.games) : '—' });
  } else {
    out.push(
      { label: 'Target share', value: fmt.pct(p.usage.targetShare, 1) },
      { label: 'RZ share', value: fmt.pct(p.usage.redZoneShare), title: 'Share of team red-zone opportunities' },
      { label: 'aDOT', value: fmt.num(p.usage.aDot) },
    );
    if (p.position !== 'RB') out.push({ label: 'Air yds share', value: fmt.pct(p.usage.airYardsShare, 1) });
    else out.push({ label: 'Carry share', value: fmt.pct(p.usage.carryShare) });
  }
  return out;
}
