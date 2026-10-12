import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Scale, X } from 'lucide-react';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerCell } from '@/components/common/PlayerCell';
import { PlayerSearch } from '@/components/common/PlayerSearch';
import { EmptyState } from '@/components/common/states';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { headToHead } from '@/engine/lineup/optimizer';
import { fmt, lastName } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Side-by-side comparison of up to four players for this week. */
export function ComparePanel({ u, initial, defaults }: { u: UniverseState; initial?: string; defaults?: { entry: { id: string } | null; alt: { id: string } | null } }) {
  const t = useChartTheme();
  const [ids, setIds] = useState<string[]>(() => {
    const seed = [initial, defaults?.entry?.id, defaults?.alt?.id].filter(Boolean) as string[];
    return [...new Set(seed)].slice(0, 2);
  });
  const rows = ids.map((id) => ({ p: u.players.get(id)!, v: u.universe.byId.get(id)! })).filter((r) => r.p && r.v);
  const best = rows.reduce((b, r, i) => (r.v.week.mean > (rows[b]?.v.week.mean ?? -1) ? i : b), 0);
  const data = rows.map((r) => ({ name: lastName(r.p.name), Projection: r.v.week.mean, err: [r.v.week.mean - r.v.week.floor, r.v.week.ceiling - r.v.week.mean] }));
  const metrics = useMemo(() => [
    ['This week', (r: (typeof rows)[number]) => (r.v.week.bye ? 'BYE' : `${r.v.week.home ? 'vs' : '@'} ${r.v.week.opp}`)],
    ['Matchup rank', (r: (typeof rows)[number]) => (r.v.week.matchupRank ? `${r.v.week.matchupRank}/32` : '—')],
    ['Projection', (r: (typeof rows)[number]) => fmt.num(r.v.week.mean)],
    ['Floor / ceiling', (r: (typeof rows)[number]) => `${fmt.num(r.v.week.floor, 0)} / ${fmt.num(r.v.week.ceiling, 0)}`],
    ['Season PPG (proj)', (r: (typeof rows)[number]) => fmt.num(r.v.ppg)],
    ['ROS points', (r: (typeof rows)[number]) => fmt.num(r.v.ros.points, 0)],
    ['Redraft value', (r: (typeof rows)[number]) => fmt.value(r.v.redraftValue)],
    ['Dynasty value', (r: (typeof rows)[number]) => fmt.value(r.v.dynastyValue)],
  ] as const, []);

  return (
    <Card>
      <CardHeader icon={<Scale />} title="Player comparison" subtitle="Compare up to four players head to head" actions={rows.length < 4 && <PlayerSearch u={u} onPick={(id) => setIds((x) => [...x, id])} exclude={ids} label="Add" align="end" />} />
      {rows.length === 0 ? <EmptyState icon={<Scale />} title="Pick players to compare" /> : (
        <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="w-36" />
                  {rows.map((r, i) => (
                    <th key={r.p.id} className={cn('min-w-[170px] rounded-t-md p-2 text-left font-normal', i === best && rows.length > 1 && 'bg-accent/[0.07]')}>
                      <div className="flex items-start gap-1">
                        <PlayerCell player={r.p} team={u.teams.get(r.p.team)} posRank={r.v.posRank} className="flex-1" />
                        <Button size="icon-sm" variant="ghost" onClick={() => setIds((x) => x.filter((y) => y !== r.p.id))} aria-label={`Remove ${r.p.name}`}><X /></Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map(([label, f]) => (
                  <tr key={label} className="border-t border-border/70">
                    <td className="py-2 pr-3 text-xs text-fg-subtle">{label}</td>
                    {rows.map((r, i) => <td key={r.p.id} className={cn('num p-2 font-medium', i === best && rows.length > 1 && 'bg-accent/[0.07]')}>{f(r)}</td>)}
                  </tr>
                ))}
                {rows.length === 2 && (
                  <tr className="border-t border-border/70">
                    <td className="py-2 pr-3 text-xs text-fg-subtle">Win head-to-head</td>
                    {rows.map((r, i) => {
                      const o = rows[1 - i];
                      const pr = headToHead({ id: r.p.id, position: r.p.position, mean: r.v.week.mean, sd: r.v.week.sd || 1 }, { id: o.p.id, position: o.p.position, mean: o.v.week.mean, sd: o.v.week.sd || 1 });
                      return <td key={r.p.id} className={cn('num p-2 font-semibold', pr >= 0.5 ? 'text-pos' : 'text-fg-muted', i === best && 'bg-accent/[0.07]')}>{fmt.pct(pr)}</td>;
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" {...axisProps(t)} />
                <YAxis {...axisProps(t)} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="Projection" radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={600}>
                  {data.map((_, i) => <Cell key={i} fill={i === best ? t.accent : t.neutral} />)}
                  <ErrorBar dataKey="err" width={8} stroke={t.textMuted} strokeWidth={1.5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-center text-2xs text-fg-subtle">Bars: median · whiskers: floor to ceiling</p>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
