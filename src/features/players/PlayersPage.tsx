import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { useUniverse, type UniverseState } from '@/hooks/useUniverse';
import { useAllLogs } from '@/data/queries';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { PlayerCell } from '@/components/common/PlayerCell';
import { AgeIndicator } from '@/components/common/badges';
import { TrendArrow, ValueBar } from '@/components/common/metrics';
import { LastUpdated, PageSkeleton } from '@/components/common/states';
import { Sparkline } from '@/components/charts/Sparkline';
import { ModeChips } from '@/components/layout/LeagueSwitcher';
import { fmt } from '@/lib/format';
import { recentTrend } from '@/lib/stats';
import { MODE_LABEL } from '@/lib/league';
import type { Player, Position } from '@/data/types';
import type { PlayerValuation } from '@/engine/valuation';

export interface PlayerRow {
  p: Player;
  v: PlayerValuation;
  trend: { delta: number; series: number[] };
  owner: string;
  ownerId: string | null;
}

type PosFilter = 'ALL' | Position;
type OwnFilter = 'all' | 'mine' | 'fa';

export function playerRows(u: UniverseState, logs: Record<string, import('@/data/types').GameLog[]> | undefined): PlayerRow[] {
  return u.universe.ranked.map((v) => {
    const p = u.players.get(v.playerId)!;
    const ownerId = u.rosteredBy.get(p.id) ?? null;
    const owner = ownerId ? (ownerId === u.league.myTeamId ? 'My team' : u.league.rosters.find((t) => t.id === ownerId)?.name ?? '—') : 'Free agent';
    const tr = logs ? recentTrend(logs[p.id] ?? [], p.position, u.league.scoring) : { delta: 0, series: [] };
    return { p, v, trend: { delta: tr.delta, series: tr.series }, owner, ownerId };
  });
}

export default function PlayersPage() {
  const { data: u, isLoading } = useUniverse();
  const logs = useAllLogs();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const pos = (params.get('pos') as PosFilter) || 'ALL';
  const [own, setOwn] = useState<OwnFilter>('all');

  const rows = useMemo(() => (u ? playerRows(u, logs.data) : []), [u, logs.data]);
  const filtered = useMemo(
    () => rows.filter((r) => (pos === 'ALL' || r.p.position === pos) && (own === 'all' || (own === 'mine' ? r.ownerId === u?.league.myTeamId : !r.ownerId))),
    [rows, pos, own, u],
  );

  const columns = useMemo<ColumnDef<PlayerRow>[]>(() => {
    if (!u) return [];
    return [
      { id: 'rank', header: '#', accessorFn: (r) => r.v.overallRank, meta: { numeric: true, width: 52, label: 'Rank' }, enableHiding: false, cell: (c) => <span className="text-fg-subtle">{c.getValue<number>()}</span> },
      {
        id: 'player', header: 'Player', accessorFn: (r) => r.p.name, enableHiding: false, meta: { sticky: true, width: 240 },
        cell: ({ row: { original: r } }) => <PlayerCell player={r.p} team={u.teams.get(r.p.team)} posRank={r.v.posRank} />,
      },
      {
        id: 'opp', header: 'Wk opp', accessorFn: (r) => r.v.week.matchupRank ?? 0, meta: { label: 'This week' },
        cell: ({ row: { original: r } }) => r.v.week.bye ? <Badge>BYE</Badge> : (
          <span className="text-xs"><span className="text-fg-subtle">{r.v.week.home ? 'vs' : '@'}</span> <span className="font-semibold">{r.v.week.opp}</span>{r.v.week.matchupRank && <span className={r.v.week.matchupRank >= 22 ? 'ml-1 text-pos' : r.v.week.matchupRank <= 10 ? 'ml-1 text-neg' : 'ml-1 text-fg-subtle'}>({r.v.week.matchupRank})</span>}</span>
        ),
      },
      { id: 'age', header: 'Age', accessorFn: (r) => r.p.age || 0, meta: { numeric: true, width: 70 }, cell: ({ row: { original: r } }) => <AgeIndicator age={r.p.age} pos={r.p.position} /> },
      {
        id: 'value', header: `${MODE_LABEL[u.league.mode]} value`, accessorFn: (r) => r.v.value, meta: { numeric: true, width: 140, label: 'Mode value' }, enableHiding: false,
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center justify-end gap-2">
            <ValueBar value={r.v.value} className="hidden w-14 md:block" />
            <span className="w-12 font-semibold text-fg">{fmt.value(r.v.value)}</span>
          </div>
        ),
      },
      { id: 'redraft', header: 'Redraft', accessorFn: (r) => r.v.redraftValue, meta: { numeric: true }, cell: (c) => fmt.value(c.getValue<number>()) },
      { id: 'dynasty', header: 'Dynasty', accessorFn: (r) => r.v.dynastyValue, meta: { numeric: true }, cell: (c) => fmt.value(c.getValue<number>()) },
      { id: 'tier', header: 'Tier', accessorFn: (r) => r.v.tier, meta: { numeric: true, width: 56 }, cell: (c) => <span className="text-fg-muted">T{c.getValue<number>()}</span> },
      { id: 'ppg', header: 'Proj PPG', accessorFn: (r) => r.v.ppg, meta: { numeric: true, label: 'Projected PPG' }, cell: (c) => fmt.num(c.getValue<number>()) },
      { id: 'week', header: 'Wk proj', accessorFn: (r) => r.v.week.mean, meta: { numeric: true, label: 'Week projection' }, cell: ({ row: { original: r } }) => <span className="font-semibold">{fmt.num(r.v.week.mean)}</span> },
      { id: 'ros', header: 'ROS pts', accessorFn: (r) => r.v.ros.points, meta: { numeric: true, label: 'Rest of season' }, cell: (c) => fmt.num(c.getValue<number>(), 0) },
      {
        id: 'trend', header: 'Form', accessorFn: (r) => r.trend.delta, meta: { numeric: true, width: 140, label: 'Recent form' },
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center justify-end gap-2">
            <div className="h-6 w-16">{r.trend.series.length > 1 && <Sparkline data={r.trend.series} height={24} tone={r.trend.delta >= 0 ? 'pos' : 'neg'} />}</div>
            <TrendArrow value={r.trend.delta} className="w-12 justify-end" />
          </div>
        ),
      },
      { id: 'owner', header: 'Roster', accessorFn: (r) => r.owner, meta: { width: 150 }, cell: ({ row: { original: r } }) => <span className={r.ownerId === u.league.myTeamId ? 'text-xs font-semibold text-accent' : !r.ownerId ? 'text-xs font-semibold text-pos' : 'truncate text-xs text-fg-subtle'}>{r.owner}</span> },
    ];
  }, [u]);

  if (isLoading || !u) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Rankings priced for <b className="text-fg">{u.league.name}</b> <ModeChips mode={u.league.mode} superflex={u.league.superflex} /></span>}
        actions={<LastUpdated at={u.fetchedAt} source={u.source} />}
      />
      <Card className="overflow-hidden">
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.p.id}
          onRowClick={(r) => nav(`/players/${r.p.id}`)}
          initialSort={[{ id: 'value', desc: true }]}
          initialHidden={{ redraft: u.league.mode !== 'redraft', dynasty: u.league.mode !== 'dynasty', ros: false }}
          searchPlaceholder="Filter by name or team…"
          globalFilterFn={(row, _id, value: string) => {
            const s = value.toLowerCase();
            return row.original.p.name.toLowerCase().includes(s) || row.original.p.team.toLowerCase() === s;
          }}
          maxHeight="calc(100dvh - 240px)"
          emptyTitle="No players match"
          toolbar={
            <>
              <Segmented<PosFilter>
                size="sm"
                value={pos}
                onChange={(v) => setParams(v === 'ALL' ? {} : { pos: v }, { replace: true })}
                options={(['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as PosFilter[]).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v }))}
                layoutId="players-pos"
                aria-label="Position"
              />
              <Segmented<OwnFilter>
                size="sm"
                value={own}
                onChange={setOwn}
                options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'My team' }, { value: 'fa', label: 'Free agents' }]}
                layoutId="players-own"
                aria-label="Roster status"
              />
            </>
          }
        />
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle"><Users className="size-3.5" /> Matchup rank: 1 = toughest defense vs the position, 32 = softest.</p>
    </div>
  );
}
