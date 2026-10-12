import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Home, Shield } from 'lucide-react';
import type { GameLog, Player } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/common/states';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { logPoints } from '@/lib/stats';
import { mean } from '@/lib/utils';
import { fmt } from '@/lib/format';
import { TrendArrow } from '@/components/common/metrics';

interface Split { label: string; games: number; ppg: number }

export function SplitsTab({ u, p, logs }: { u: UniverseState; p: Player; logs: GameLog[] }) {
  const pts = useMemo(() => logs.map((l) => ({ l, pts: logPoints(l, p.position, u.league.scoring) })), [logs, p.position, u.league.scoring]);
  const avg = mean(pts.map((x) => x.pts));
  const group = (label: string, f: (l: GameLog) => boolean): Split => {
    const xs = pts.filter((x) => f(x.l));
    return { label, games: xs.length, ppg: mean(xs.map((x) => x.pts)) };
  };
  const sets: { title: string; icon: React.ReactNode; subtitle: string; splits: Split[] }[] = [
    { title: 'Home / away', icon: <Home />, subtitle: 'Venue split', splits: [group('Home', (l) => l.home), group('Away', (l) => !l.home)] },
    { title: 'Vs defense rank', icon: <Shield />, subtitle: `Opponent rank vs ${p.position} (1 = toughest)`, splits: [group('Top 10', (l) => l.oppRankVsPos <= 10), group('Middle', (l) => l.oppRankVsPos > 10 && l.oppRankVsPos < 23), group('Bottom 10', (l) => l.oppRankVsPos >= 23)] },
    { title: 'Weather', icon: <CloudRain />, subtitle: 'Game conditions', splits: [group('Dome', (l) => l.weather.condition === 'Dome'), group('Fair', (l) => ['Clear', 'Cloudy'].includes(l.weather.condition) && l.weather.tempF >= 40), group('Adverse', (l) => ['Rain', 'Snow', 'Wind'].includes(l.weather.condition) || (l.weather.condition !== 'Dome' && l.weather.tempF < 40))] },
  ];
  if (!logs.length) return <Card><EmptyState title="No splits yet" description="Splits populate once games are played." /></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {sets.map((s) => <SplitCard key={s.title} {...s} avg={avg} />)}
    </div>
  );
}

function SplitCard({ title, icon, subtitle, splits, avg }: { title: string; icon: React.ReactNode; subtitle: string; splits: Split[]; avg: number }) {
  const t = useChartTheme();
  const data = splits.map((s) => ({ ...s, PPG: s.games ? s.ppg : 0 }));
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      <CardBody>
        <div className="h-[160px]">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axisProps(t)} />
              <YAxis {...axisProps(t)} axisLine={false} />
              <ReferenceLine y={avg} stroke={t.textMuted} strokeDasharray="4 4" label={{ value: 'Season avg', position: 'insideTopRight', fill: t.textMuted, fontSize: 10 }} />
              <Tooltip content={<ChartTooltip format={(v) => `${v.toFixed(1)} ppg`} />} />
              <Bar dataKey="PPG" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={600}>
                {data.map((d) => <Cell key={d.label} fill={d.games ? t.accent : t.grid} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {splits.map((s) => (
              <tr key={s.label} className="border-t border-border/70">
                <td className="py-2">{s.label}</td>
                <td className="num py-2 text-right text-xs text-fg-subtle">{s.games} G</td>
                <td className="num py-2 text-right font-semibold">{s.games ? fmt.num(s.ppg) : '—'}</td>
                <td className="w-20 py-2 text-right">{s.games ? <TrendArrow value={s.ppg - avg} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
