import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Flame, Gem, Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { useTrending } from '@/data/queries';
import { useLeagues } from '@/store/leagues';
import type { Player, Position } from '@/data/types';
import type { PlayerValuation } from '@/engine/valuation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { PlayerCell } from '@/components/common/PlayerCell';
import { AgeIndicator } from '@/components/common/badges';
import { ValueBar } from '@/components/common/metrics';
import { LastUpdated, PageSkeleton } from '@/components/common/states';
import { fmt } from '@/lib/format';
import { cn, mean } from '@/lib/utils';
import { rankHeat } from '@/lib/heat';

interface Row { p: Player; v: PlayerValuation; fa: boolean; adds?: number; rosterPct?: number; delta?: number; next4: number; sos: number }

function rowFor(u: UniverseState, id: string, extra: Partial<Row> = {}): Row | null {
  const p = u.players.get(id);
  const v = u.universe.byId.get(id);
  if (!p || !v) return null;
  const next = v.ros.weeks.slice(0, 4);
  const ranks = next.map((w) => w.matchupRank).filter((x): x is number => x != null);
  return { p, v, fa: !u.rosteredBy.has(id), next4: next.reduce((a, w) => a + w.points, 0), sos: ranks.length ? mean(ranks) : 16, ...extra };
}

export default function WaiversPage() {
  const { data: u, isLoading } = useUniverse();
  const trending = useTrending(u?.core);
  const [pos, setPos] = useState<'ALL' | Position>('ALL');
  const updateTeam = useLeagues((s) => s.updateTeam);
  const nav = useNavigate();

  const sets = useMemo(() => {
    if (!u) return null;
    const fas = u.universe.ranked.filter((v) => !u.rosteredBy.has(v.playerId)).map((v) => rowFor(u, v.playerId)!).filter(Boolean);
    return {
      trending: (trending.data?.data ?? []).map((t) => rowFor(u, t.playerId, { adds: t.adds, rosterPct: t.rosterPct, delta: t.rosterPctDelta })).filter(Boolean) as Row[],
      winNow: [...fas].filter((r) => r.p.position !== 'DST' || true).sort((a, b) => b.v.ros.vorp - a.v.ros.vorp).slice(0, 80),
      stash: fas.filter((r) => r.p.age > 0 && r.p.age <= 25.5 && ['QB', 'RB', 'WR', 'TE'].includes(r.p.position)).sort((a, b) => b.v.dynastyValue - a.v.dynastyValue).slice(0, 60),
    };
  }, [u, trending.data]);

  if (isLoading || !u || !sets) return <PageSkeleton />;
  const me = u.league.rosters.find((t) => t.id === u.league.myTeamId)!;
  const claim = (p: Player) => {
    updateTeam(u.league.id, me.id, { playerIds: [...me.playerIds, p.id] });
    toast.success(`${p.name} added to ${me.name}`, { description: me.playerIds.length + 1 > u.league.rosterSize ? 'Roster is over the limit — drop someone in Lineup → Edit roster.' : undefined, action: { label: 'Lineup', onClick: () => nav('/lineup') } });
  };
  const filter = (rows: Row[]) => rows.filter((r) => pos === 'ALL' || r.p.position === pos);

  const base: ColumnDef<Row>[] = [
    { id: 'player', header: 'Player', accessorFn: (r) => r.p.name, enableHiding: false, meta: { sticky: true, width: 230 }, cell: ({ row: { original: r } }) => <PlayerCell player={r.p} team={u.teams.get(r.p.team)} posRank={r.v.posRank} /> },
    { id: 'age', header: 'Age', accessorFn: (r) => r.p.age, meta: { numeric: true, width: 72 }, cell: ({ row: { original: r } }) => <AgeIndicator age={r.p.age} pos={r.p.position} /> },
    { id: 'wk', header: 'Wk proj', accessorFn: (r) => r.v.week.mean, meta: { numeric: true }, cell: (c) => fmt.num(c.getValue<number>()) },
    { id: 'next4', header: 'Next 4', accessorFn: (r) => r.next4, meta: { numeric: true, label: 'Next 4 weeks' }, cell: (c) => <span className="font-semibold">{fmt.num(c.getValue<number>(), 0)}</span> },
    { id: 'sos', header: 'SOS', accessorFn: (r) => r.sos, meta: { numeric: true, label: 'Schedule (avg rank next 4)' }, cell: ({ row: { original: r } }) => <span className={cn('num inline-grid h-6 w-10 place-items-center rounded text-xs font-semibold', rankHeat(Math.round(r.sos)))}>{r.sos.toFixed(0)}</span> },
    { id: 'ros', header: 'ROS pts', accessorFn: (r) => r.v.ros.points, meta: { numeric: true }, cell: (c) => fmt.num(c.getValue<number>(), 0) },
  ];
  const action: ColumnDef<Row> = { id: 'add', header: '', enableSorting: false, enableHiding: false, meta: { width: 96 }, cell: ({ row: { original: r } }) => (r.fa ? <Button size="xs" variant="secondary" onClick={(e) => { e.stopPropagation(); claim(r.p); }}><Plus /> Add</Button> : <Badge>Rostered</Badge>) };

  const trendCols: ColumnDef<Row>[] = [
    base[0],
    { id: 'adds', header: 'Adds (24h)', accessorFn: (r) => r.adds ?? 0, meta: { numeric: true }, cell: (c) => <span className="font-semibold text-pos">+{fmt.int(c.getValue<number>())}</span> },
    { id: 'rost', header: 'Rostered', accessorFn: (r) => r.rosterPct ?? 0, meta: { numeric: true }, cell: ({ row: { original: r } }) => (r.rosterPct ? <span>{fmt.pct(r.rosterPct)} <span className="text-2xs text-pos">+{fmt.pct(r.delta ?? 0)}</span></span> : '—') },
    ...base.slice(1),
    action,
  ];
  const winCols: ColumnDef<Row>[] = [...base, { id: 'value', header: 'Redraft value', accessorFn: (r) => r.v.redraftValue, meta: { numeric: true, width: 140 }, cell: ({ row: { original: r } }) => <div className="flex items-center justify-end gap-2"><ValueBar value={r.v.redraftValue} className="w-14" /><span className="w-12">{fmt.value(r.v.redraftValue)}</span></div> }, action];
  const stashCols: ColumnDef<Row>[] = [
    base[0], base[1],
    { id: 'draft', header: 'Draft', accessorFn: (r) => (r.p.draft ? r.p.draft.round : 9), meta: { numeric: true }, cell: ({ row: { original: r } }) => (r.p.draft ? `${r.p.draft.year} R${r.p.draft.round}` : 'UDFA') },
    { id: 'dyn', header: 'Dynasty value', accessorFn: (r) => r.v.dynastyValue, meta: { numeric: true, width: 150 }, cell: ({ row: { original: r } }) => <div className="flex items-center justify-end gap-2"><ValueBar value={r.v.dynastyValue} className="w-14" /><span className="w-12 font-semibold">{fmt.value(r.v.dynastyValue)}</span></div> },
    { id: 'upside', header: 'Upside', accessorFn: (r) => r.v.dynastyValue - r.v.redraftValue, meta: { numeric: true, label: 'Dynasty minus redraft' }, cell: (c) => <span className={c.getValue<number>() > 0 ? 'text-pos' : 'text-fg-subtle'}>{fmt.signedInt(c.getValue<number>())}</span> },
    { id: 'y3', header: 'Yr 3 proj', accessorFn: (r) => r.v.dynasty.seasonPoints[2] ?? 0, meta: { numeric: true, label: 'Projected points in 2 seasons' }, cell: (c) => fmt.num(c.getValue<number>(), 0) },
    action,
  ];
  const toolbar = <Segmented size="sm" value={pos} onChange={setPos} layoutId="wv-pos" aria-label="Position" options={(['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v }))} />;
  const table = (rows: Row[], cols: ColumnDef<Row>[], sort: string) => (
    <Card className="overflow-hidden">
      <DataTable data={filter(rows)} columns={cols} getRowId={(r) => r.p.id} onRowClick={(r) => nav(`/players/${r.p.id}`)} initialSort={[{ id: sort, desc: true }]} toolbar={toolbar} maxHeight="calc(100dvh - 300px)" emptyTitle="No players here" emptyDescription="Try another position filter." />
    </Card>
  );
  return (
    <div>
      <PageHeader title="Waiver Wire" subtitle={`Free agents in ${u.league.name} · ${u.league.rosterSize - me.playerIds.length >= 0 ? `${u.league.rosterSize - me.playerIds.length} open roster spots` : 'roster full'}`} actions={<LastUpdated at={trending.dataUpdatedAt || undefined} source={trending.data?.source} />} />
      <Tabs defaultValue={u.league.mode === 'dynasty' ? 'stash' : 'winnow'}>
        <TabsList className="mb-4">
          <TabsTrigger value="winnow"><Rocket /> Win-now pickups</TabsTrigger>
          <TabsTrigger value="stash"><Gem /> Dynasty stashes</TabsTrigger>
          <TabsTrigger value="trending"><Flame /> Trending adds</TabsTrigger>
        </TabsList>
        <TabsContent value="winnow">{table(sets.winNow, winCols, 'value')}</TabsContent>
        <TabsContent value="stash">{table(sets.stash, stashCols, 'dyn')}</TabsContent>
        <TabsContent value="trending">{table(sets.trending, trendCols, 'adds')}</TabsContent>
      </Tabs>
    </div>
  );
}
