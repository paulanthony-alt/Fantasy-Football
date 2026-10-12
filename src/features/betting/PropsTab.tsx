import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Flag, Plus } from 'lucide-react';
import type { PlayerProp, PropMarket } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { analyzeProp, type PropAnalysis } from '@/engine/betting/model';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/common/DataTable';
import { PlayerCell } from '@/components/common/PlayerCell';
import { CardSkeleton } from '@/components/common/states';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { trackBet } from './trackBet';

const MARKET: Record<PropMarket, string> = { passYds: 'Pass yds', passTd: 'Pass TDs', rushYds: 'Rush yds', recYds: 'Rec yds', rec: 'Receptions', anytimeTd: 'Anytime TD' };

export function PropsTab({ u, props, loading }: { u: UniverseState; props?: PlayerProp[]; loading: boolean }) {
  const [market, setMarket] = useState<'all' | PropMarket>('all');
  const [valueOnly, setValueOnly] = useState(false);
  const rows = useMemo(() => (props ?? []).map((pr) => {
    const p = u.players.get(pr.playerId)!;
    const g = u.core.games.find((x) => x.id === pr.gameId);
    const opp = g ? u.teams.get(g.home === p.team ? g.away : g.home) : undefined;
    return { ...analyzeProp(pr, p, opp), opp: opp?.id };
  }), [props, u]);
  const filtered = rows.filter((r) => (market === 'all' || r.prop.market === market) && (!valueOnly || r.value));
  const columns = useMemo<ColumnDef<PropAnalysis & { opp?: string }>[]>(() => [
    { id: 'player', header: 'Player', accessorFn: (r) => u.players.get(r.prop.playerId)!.name, meta: { sticky: true, width: 220 }, enableHiding: false, cell: ({ row: { original: r } }) => { const p = u.players.get(r.prop.playerId)!; return <PlayerCell player={p} team={u.teams.get(p.team)} sub={r.opp ? `vs ${r.opp}` : undefined} />; } },
    { id: 'market', header: 'Market', accessorFn: (r) => MARKET[r.prop.market], cell: (c) => <span className="text-sm">{c.getValue<string>()}</span> },
    { id: 'line', header: 'Line', accessorFn: (r) => r.prop.line, meta: { numeric: true }, cell: ({ row: { original: r } }) => <span>{r.prop.market === 'anytimeTd' ? 'Yes' : r.prop.line}{r.prop.openLine !== r.prop.line && r.prop.market !== 'anytimeTd' && <span className="ml-1 text-2xs text-fg-subtle">(o {r.prop.openLine})</span>}</span> },
    { id: 'odds', header: 'Over / Under', accessorFn: (r) => r.prop.overOdds, meta: { numeric: true, label: 'Odds' }, cell: ({ row: { original: r } }) => <span className="text-fg-muted">{fmt.odds(r.prop.overOdds)}{r.prop.market !== 'anytimeTd' && ` / ${fmt.odds(r.prop.underOdds)}`}</span> },
    { id: 'proj', header: 'Model', accessorFn: (r) => r.projection, meta: { numeric: true, label: 'Model projection' }, cell: ({ row: { original: r } }) => <span className="font-semibold text-accent">{r.prop.market === 'anytimeTd' ? fmt.pct(r.pOver) : fmt.num(r.projection)}</span> },
    { id: 'pover', header: 'P(over)', accessorFn: (r) => r.pOver, meta: { numeric: true }, cell: (c) => fmt.pct(c.getValue<number>()) },
    { id: 'side', header: 'Lean', accessorFn: (r) => r.side, cell: ({ row: { original: r } }) => <Badge tone={r.side === 'over' ? 'accent' : 'neutral'}>{r.prop.market === 'anytimeTd' ? 'Yes' : r.side === 'over' ? 'Over' : 'Under'}</Badge> },
    { id: 'edge', header: 'Edge', accessorFn: (r) => r.edge, meta: { numeric: true }, enableHiding: false, cell: ({ row: { original: r } }) => <span className={cn('inline-flex items-center gap-1 font-semibold', r.edge > 0 ? 'text-pos' : 'text-neg')}>{r.value && <Flag className="size-3" />}{fmt.signedPct(r.edge)}</span> },
    { id: 'track', header: '', enableSorting: false, enableHiding: false, meta: { width: 72 }, cell: ({ row: { original: r } }) => { const p = u.players.get(r.prop.playerId)!; return <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); trackBet('prop', `${p.name} ${r.prop.market === 'anytimeTd' ? 'anytime TD' : `${r.side === 'over' ? 'o' : 'u'}${r.prop.line} ${MARKET[r.prop.market].toLowerCase()}`}`, r.odds, r.edge); }}><Plus /> Track</Button>; } },
  ], [u]);
  if (loading) return <Card><CardSkeleton rows={8} /></Card>;
  return (
    <Card className="overflow-hidden">
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.prop.id}
        initialSort={[{ id: 'edge', desc: true }]}
        maxHeight="calc(100dvh - 330px)"
        searchPlaceholder="Filter players…"
        globalFilterFn={(row, _c, v: string) => u.players.get(row.original.prop.playerId)!.name.toLowerCase().includes(v.toLowerCase())}
        toolbar={
          <>
            <Segmented size="sm" value={market} onChange={setMarket} layoutId="prop-mkt" aria-label="Market" options={[{ value: 'all' as const, label: 'All' }, ...(Object.keys(MARKET) as PropMarket[]).map((m) => ({ value: m, label: MARKET[m] }))]} />
            <label className="flex items-center gap-2 text-xs text-fg-muted"><Switch checked={valueOnly} onCheckedChange={setValueOnly} /> Value only</label>
          </>
        }
      />
    </Card>
  );
}
