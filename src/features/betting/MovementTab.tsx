import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, Users } from 'lucide-react';
import type { GameOdds } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { CardSkeleton } from '@/components/common/states';
import { KpiTile } from '@/components/common/metrics';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { fmt } from '@/lib/format';

const day = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' });

export function MovementTab({ u, odds, loading }: { u: UniverseState; odds?: GameOdds[]; loading: boolean }) {
  const t = useChartTheme();
  const games = useMemo(() => (odds ?? []).map((o) => ({ o, g: u.core.games.find((g) => g.id === o.gameId)! })).filter((x) => x.g?.week === u.core.week), [odds, u]);
  const [id, setId] = useState<string>('');
  const sel = games.find((x) => x.o.gameId === id) ?? games.sort((a, b) => Math.abs(b.o.spread - b.o.open.spread) - Math.abs(a.o.spread - a.o.open.spread))[0];
  if (loading || !sel) return <Card><CardSkeleton rows={6} /></Card>;
  const { o, g } = sel;
  const data = o.history.map((h) => ({ t: h.t, Spread: h.spread, Total: h.total, 'Home ML': h.homeMl }));
  const chart = (key: 'Spread' | 'Total', color: string) => (
    <div className="h-[220px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={day} {...axisProps(t)} tickCount={5} />
          <YAxis {...axisProps(t)} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip content={<ChartTooltip labelFormat={(l) => new Date(Number(l)).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} format={(v) => (key === 'Spread' ? fmt.spread(v) : v.toFixed(1))} />} />
          <Line type="stepAfter" dataKey={key} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={600} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select className="w-64" value={o.gameId} onValueChange={setId} options={games.map(({ g: x, o: y }) => ({ value: y.gameId, label: `${x.away} @ ${x.home}`, hint: `${fmt.signed(y.spread - y.open.spread)}` }))} aria-label="Game" />
        <span className="text-xs text-fg-subtle">Book: {o.book}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Spread" value={`${g.home} ${fmt.spread(o.spread)}`} sub={`Opened ${fmt.spread(o.open.spread)} · ${fmt.signed(o.spread - o.open.spread)}`} />
        <KpiTile label="Total" value={o.total.toFixed(1)} sub={`Opened ${o.open.total} · ${fmt.signed(o.total - o.open.total)}`} />
        <KpiTile label="Moneyline" value={`${fmt.odds(o.awayMl)} / ${fmt.odds(o.homeMl)}`} sub={`${g.away} / ${g.home}`} />
        <KpiTile label="Public on home" icon={<Users />} value={fmt.pct(o.publicHomePct)} sub={o.publicHomePct > 0.6 && o.spread - o.open.spread > 0 ? 'Reverse line move — sharp side away' : 'Ticket share (est.)'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader icon={<TrendingUp />} title={`Spread · ${g.home}`} subtitle="Negative = home favored" /><CardBody>{chart('Spread', t.series[0])}</CardBody></Card>
        <Card><CardHeader icon={<TrendingUp />} title="Game total" subtitle="Over/under points" /><CardBody>{chart('Total', t.series[1])}</CardBody></Card>
      </div>
    </div>
  );
}
