import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import type { LeagueMode, Position } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { buildContext, valueUniverse, valuePick, pickModeValue, tierFor } from '@/engine/valuation';
import { applySuperflex } from '@/lib/league';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/common/DataTable';
import { PlayerCell } from '@/components/common/PlayerCell';
import { AgeIndicator, PositionBadge } from '@/components/common/badges';
import { TrendArrow, ValueBar } from '@/components/common/metrics';
import { fmt } from '@/lib/format';

interface Row {
  id: string;
  kind: 'player' | 'pick';
  name: string;
  pos: Position | 'PICK';
  age: number;
  value: number;
  base: number;
  tier: number;
  rank: number;
}

/** Market-style trade value chart, re-priced for any mode / Superflex combination. */
export function ValueChart({ u }: { u: UniverseState }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<LeagueMode>(u.league.mode);
  const [sf, setSf] = useState(u.league.superflex);
  const [pos, setPos] = useState<'ALL' | Position | 'PICK'>('ALL');

  const rows = useMemo(() => {
    const lg = applySuperflex({ ...u.league, mode }, sf);
    const uni = sf === u.league.superflex ? u.universe : valueUniverse([...u.players.values()], buildContext(lg, u.core));
    const out: Row[] = uni.ranked.map((v) => {
      const p = u.players.get(v.playerId)!;
      const val = mode === 'redraft' ? v.redraftValue : mode === 'keeper' ? v.keeperValue : v.dynastyValue;
      const base = u.universe.byId.get(v.playerId)?.value ?? val;
      return { id: p.id, kind: 'player', name: p.name, pos: p.position, age: p.age, value: val, base, tier: tierFor(val), rank: 0 };
    });
    if (mode !== 'redraft') {
      const next = u.core.season + 1;
      for (let y = 0; y < 2; y++) {
        for (let rd = 1; rd <= 4; rd++) {
          for (const tier of ['early', 'mid', 'late'] as const) {
            const pv = valuePick({ id: 'x', season: next + y, round: rd, originalTeamId: 'x', projected: tier }, { teams: u.league.teams, superflex: sf, nextDraftSeason: next });
            const v = pickModeValue(pv, mode);
            out.push({ id: `pick-${next + y}-${rd}-${tier}`, kind: 'pick', name: pv.label, pos: 'PICK', age: 0, value: v, base: v, tier: tierFor(v), rank: 0 });
          }
        }
      }
    }
    out.sort((a, b) => b.value - a.value).forEach((r, i) => (r.rank = i + 1));
    return out;
  }, [u, mode, sf]);

  const filtered = useMemo(() => rows.filter((r) => pos === 'ALL' || r.pos === pos), [rows, pos]);
  const changed = mode !== u.league.mode || sf !== u.league.superflex;

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { id: 'rank', header: '#', accessorKey: 'rank', meta: { numeric: true, width: 52 }, enableHiding: false, cell: (c) => <span className="text-fg-subtle">{c.getValue<number>()}</span> },
    {
      id: 'name', header: 'Asset', accessorKey: 'name', enableHiding: false, meta: { sticky: true, width: 240 },
      cell: ({ row: { original: r } }) => {
        const p = u.players.get(r.id);
        return p ? <PlayerCell player={p} team={u.teams.get(p.team)} /> : (
          <div className="flex items-center gap-2.5"><div className="grid size-8 place-items-center rounded-full bg-accent/12 text-accent"><CalendarClock className="size-4" /></div><div><div className="font-medium">{r.name}</div><PositionBadge pos="PICK" className="h-4 px-1 text-[10px]" /></div></div>
        );
      },
    },
    { id: 'age', header: 'Age', accessorKey: 'age', meta: { numeric: true, width: 80 }, cell: ({ row: { original: r } }) => (r.kind === 'player' && r.pos !== 'DST' ? <AgeIndicator age={r.age} pos={r.pos as Position} /> : <span className="text-fg-subtle">—</span>) },
    { id: 'tier', header: 'Tier', accessorKey: 'tier', meta: { numeric: true, width: 60 }, cell: (c) => <span className="text-fg-muted">T{c.getValue<number>()}</span> },
    {
      id: 'value', header: 'Value', accessorKey: 'value', meta: { numeric: true, width: 180 }, enableHiding: false,
      cell: ({ row: { original: r } }) => <div className="flex items-center justify-end gap-2"><ValueBar value={r.value} className="hidden w-20 md:block" /><span className="w-12 font-semibold">{fmt.value(r.value)}</span></div>,
    },
    { id: 'delta', header: 'vs your league', accessorFn: (r) => r.value - r.base, meta: { numeric: true, label: 'Change vs league settings' }, cell: ({ row: { original: r } }) => (r.kind === 'pick' ? <span className="text-fg-subtle">—</span> : <TrendArrow value={r.value - r.base} format={(v) => fmt.int(v)} threshold={25} />) },
  ], [u]);

  return (
    <Card className="overflow-hidden">
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => r.kind === 'player' && nav(`/players/${r.id}`)}
        initialSort={[{ id: 'value', desc: true }]}
        initialHidden={{ delta: changed }}
        key={String(changed)}
        maxHeight="calc(100dvh - 300px)"
        searchPlaceholder="Find a player or pick…"
        toolbar={
          <>
            <Segmented<LeagueMode> size="sm" value={mode} onChange={setMode} layoutId="vc-mode" aria-label="Mode" options={[{ value: 'redraft', label: 'Redraft' }, { value: 'dynasty', label: 'Dynasty' }, { value: 'keeper', label: 'Keeper' }]} />
            <label className="flex items-center gap-2 text-xs text-fg-muted"><Switch checked={sf} onCheckedChange={setSf} /> Superflex</label>
            <Segmented size="sm" value={pos} onChange={setPos} layoutId="vc-pos" aria-label="Position" options={(['ALL', 'QB', 'RB', 'WR', 'TE', 'PICK'] as const).map((v) => ({ value: v, label: v === 'ALL' ? 'All' : v === 'PICK' ? 'Picks' : v }))} />
          </>
        }
      />
    </Card>
  );
}
